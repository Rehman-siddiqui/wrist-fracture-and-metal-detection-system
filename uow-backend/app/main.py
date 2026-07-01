"""
Wrist Fracture and Metal Detection System Backend
==========================
Complete role-based access control system with:
- Client: Upload & analyze images
- Hospital: Manage assigned clients, analyze images
- Admin: Full system management
"""

from typing import Optional
from fastapi import FastAPI, Depends, Form, HTTPException, status
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr
from app.api.endpoints.xray import router as xray_router
from app.api.endpoints.admin import router as admin_router, get_admin_endpoints
from app.api.endpoints.hospital import router as hospital_router, get_hospital_endpoints
import enum

# ============ Database Configuration ============

import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/uow")
# pool_pre_ping + pool_recycle keep the app resilient to Neon (serverless Postgres)
# closing idle connections when it auto-suspends; without these the first request
# after an idle period fails with "SSL connection has been closed unexpectedly".
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ============ JWT Settings ============

import secrets
# Never hardcode a real secret in source (public repo). Use SECRET_KEY from the
# environment; fall back to a random per-process key for local/dev only.
# In production you MUST set SECRET_KEY (otherwise tokens reset on each restart).
SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# ============ Password & Auth ============

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# ============ Pydantic Models ============

class UserInfo(BaseModel):
    id: int
    email: str
    name: str
    role: str


class UserSignupInput(BaseModel):
    email: EmailStr
    password: str
    role: str
    name: str
    # Client fields
    clientId: Optional[str] = None
    organization: Optional[str] = None
    preferredHospitalId: Optional[int] = None  # Client's preferred hospital for auto-assignment
    # Hospital fields
    hospitalId: Optional[str] = None  # Staff ID
    hospitalEntityId: Optional[int] = None  # Existing hospital selection
    department: Optional[str] = None
    position: Optional[str] = None
    # New hospital creation fields (when hospitalEntityId is not provided)
    newHospitalName: Optional[str] = None
    newHospitalCode: Optional[str] = None
    newHospitalAddress: Optional[str] = None
    newHospitalPhone: Optional[str] = None
    newHospitalEmail: Optional[str] = None
    # Admin fields
    adminId: Optional[str] = None
    accessLevel: Optional[str] = "full"


# ============ Database Models ============

class User(Base):
    """Base user model for authentication"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    name = Column(String(255), nullable=True)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ClientProfile(Base):
    """Extended profile for client users"""
    __tablename__ = "client_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    client_id = Column(String(100), unique=True, index=True)
    organization = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)


class HospitalEntity(Base):
    """Hospital organization entity"""
    __tablename__ = "hospital_entities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True)
    address = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HospitalStaff(Base):
    """Hospital staff members (users with hospital role)"""
    __tablename__ = "hospital_staff"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospital_entities.id", ondelete="CASCADE"), index=True)
    staff_id = Column(String(100), unique=True, index=True)
    department = Column(String(255), nullable=True)
    position = Column(String(100), nullable=True)
    can_manage_clients = Column(Boolean, default=True)


class HospitalClient(Base):
    """Many-to-many relationship between hospitals and clients"""
    __tablename__ = "hospital_clients"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospital_entities.id", ondelete="CASCADE"), index=True)
    client_id = Column(Integer, ForeignKey("client_profiles.id", ondelete="CASCADE"), index=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    assigned_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)


class AdminProfile(Base):
    """Admin user profiles"""
    __tablename__ = "admin_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    admin_id = Column(String(100), unique=True, index=True)
    department = Column(String(255), nullable=True)
    access_level = Column(String(50), default="full")


class AnalysisHistory(Base):
    """Track all image analyses"""
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    hospital_id = Column(Integer, ForeignKey("hospital_entities.id", ondelete="SET NULL"), nullable=True)
    image_type = Column(String(50))
    original_filename = Column(String(255))
    processed_filename = Column(String(255), nullable=True)
    detections = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)


class ContactMessage(Base):
    """Messages submitted through the public Contact form."""
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    organization = Column(String(255), nullable=True)
    reason = Column(String(100), nullable=True)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============ Create Tables ============

Base.metadata.create_all(bind=engine)

# ============ FastAPI App ============

app = FastAPI(title="Wrist Fracture and Metal Detection System Backend")

# CORS Middleware — origins are configurable via the ALLOWED_ORIGINS env var
# (comma-separated) so the deployed frontend domain can be allowed in production.
_allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# ============ Dependencies ============

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_password_hash(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    
    # Check if user is active
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user


# ============ Initialize Routers with Dependencies ============

# Initialize admin router
get_admin_endpoints(
    get_db=get_db,
    get_current_user=get_current_user,
    get_password_hash=get_password_hash,
    User=User,
    ClientProfile=ClientProfile,
    HospitalEntity=HospitalEntity,
    HospitalStaff=HospitalStaff,
    HospitalClient=HospitalClient,
    AdminProfile=AdminProfile,
    AnalysisHistory=AnalysisHistory
)

# Initialize hospital router
get_hospital_endpoints(
    get_db=get_db,
    get_current_user=get_current_user,
    User=User,
    ClientProfile=ClientProfile,
    HospitalEntity=HospitalEntity,
    HospitalStaff=HospitalStaff,
    HospitalClient=HospitalClient,
    AnalysisHistory=AnalysisHistory
)

# Include routers
app.include_router(xray_router, prefix="/xray", tags=["xray"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])
app.include_router(hospital_router, prefix="/hospital", tags=["hospital"])


# ============ Authentication Endpoints ============

@app.post("/signup")
def signup(user_data: UserSignupInput, db: Session = Depends(get_db)):
    """Register a new user with role-specific profile"""

    # Validate password (the frontend blocks empty/weak passwords, but the API
    # must enforce this too so accounts can't be created without one)
    password = (user_data.password or "").strip()
    if len(password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long"
        )

    # Normalize role (handle legacy roles)
    role = user_data.role.lower()
    role_mapping = {
        "student": "client",
        "teacher": "admin"
    }
    role = role_mapping.get(role, role)
    
    # Validate role
    if role not in ["client", "hospital", "admin"]:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role}")
    
    # Check if user exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        role=role,
        name=user_data.name,
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create role-specific profile
    try:
        if role == "client":
            profile = ClientProfile(
                user_id=new_user.id,
                client_id=user_data.clientId or f"CLT-{new_user.id:06d}",
                organization=user_data.organization
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
            
            # Auto-assign to preferred hospital if specified
            if user_data.preferredHospitalId:
                hospital = db.query(HospitalEntity).filter(
                    HospitalEntity.id == user_data.preferredHospitalId,
                    HospitalEntity.is_active == True
                ).first()
                if hospital:
                    assignment = HospitalClient(
                        hospital_id=hospital.id,
                        client_id=profile.id,
                        is_active=True
                    )
                    db.add(assignment)
            
        elif role == "hospital":
            # For hospital signup, we need a hospital entity
            hospital_entity_id = user_data.hospitalEntityId
            
            if not hospital_entity_id:
                # Check if creating a new hospital
                if user_data.newHospitalName:
                    # Validate new hospital code is unique
                    hospital_code = user_data.newHospitalCode or f"HSP-{new_user.id:06d}"
                    existing_hospital = db.query(HospitalEntity).filter(
                        HospitalEntity.code == hospital_code
                    ).first()
                    if existing_hospital:
                        raise HTTPException(status_code=400, detail="Hospital code already exists")
                    
                    # Create a new hospital entity
                    new_hospital = HospitalEntity(
                        name=user_data.newHospitalName,
                        code=hospital_code,
                        address=user_data.newHospitalAddress,
                        phone=user_data.newHospitalPhone,
                        email=user_data.newHospitalEmail
                    )
                    db.add(new_hospital)
                    db.commit()
                    db.refresh(new_hospital)
                    hospital_entity_id = new_hospital.id
                else:
                    # No hospital selected or created - error
                    raise HTTPException(
                        status_code=400, 
                        detail="Please select an existing hospital or create a new one"
                    )
            
            profile = HospitalStaff(
                user_id=new_user.id,
                hospital_id=hospital_entity_id,
                staff_id=user_data.hospitalId or f"STF-{new_user.id:06d}",
                department=user_data.department,
                position=user_data.position or "Staff"
            )
            db.add(profile)
            
        elif role == "admin":
            profile = AdminProfile(
                user_id=new_user.id,
                admin_id=user_data.adminId or f"ADM-{new_user.id:06d}",
                department=user_data.department,
                access_level=user_data.accessLevel or "full"
            )
            db.add(profile)
        
        db.commit()
    except Exception as e:
        db.delete(new_user)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Failed to create profile: {str(e)}")
    
    return {"message": "User registered successfully", "user_id": new_user.id}


@app.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    role: str = Form(None),
    db: Session = Depends(get_db)
):
    """Login and get access token"""
    user = db.query(User).filter(User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    
    # Check user status
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is inactive. Please contact administrator.")
    
    # Normalize and check role
    if role:
        # Handle legacy role names
        role_mapping = {
            "student": "client",
            "teacher": "admin"
        }
        normalized_role = role_mapping.get(role.lower(), role.lower())
        
        if user.role != normalized_role:
            raise HTTPException(status_code=400, detail="Invalid role for this user")
    
    # Create access token
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "user_id": user.id}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "name": user.name,
        "email": user.email
    }


# ============ User Endpoints ============

@app.get("/user/info", response_model=UserInfo)
def get_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name or "User",
        "role": current_user.role
    }


@app.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user profile based on role"""
    base_profile = {
        "id": current_user.id,
        "role": current_user.role,
        "email": current_user.email,
        "name": current_user.name
    }
    
    if current_user.role == "client":
        profile = db.query(ClientProfile).filter(ClientProfile.user_id == current_user.id).first()
        if profile:
            base_profile.update({
                "client_id": profile.client_id,
                "organization": profile.organization,
                "phone": profile.phone,
                "address": profile.address
            })
    
    elif current_user.role == "hospital":
        staff = db.query(HospitalStaff).filter(HospitalStaff.user_id == current_user.id).first()
        if staff:
            hospital = db.query(HospitalEntity).filter(HospitalEntity.id == staff.hospital_id).first()
            base_profile.update({
                "staff_id": staff.staff_id,
                "department": staff.department,
                "position": staff.position,
                "hospital_name": hospital.name if hospital else None,
                "hospital_id": staff.hospital_id
            })
    
    elif current_user.role == "admin":
        admin = db.query(AdminProfile).filter(AdminProfile.user_id == current_user.id).first()
        if admin:
            base_profile.update({
                "admin_id": admin.admin_id,
                "department": admin.department,
                "access_level": admin.access_level
            })
    
    return base_profile


@app.get("/protected")
def protected_route(current_user: User = Depends(get_current_user)):
    """Protected route example"""
    return {
        "message": "You are authorized",
        "user": current_user.email,
        "role": current_user.role
    }


# ============ Analysis History ============

@app.post("/analysis/record")
def record_analysis(
    image_type: str = Form(...),
    original_filename: str = Form(...),
    processed_filename: str = Form(None),
    detections: str = Form(None),
    notes: str = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record an analysis in history"""
    hospital_id = None
    
    # If hospital staff, get their hospital ID
    if current_user.role == "hospital":
        staff = db.query(HospitalStaff).filter(HospitalStaff.user_id == current_user.id).first()
        if staff:
            hospital_id = staff.hospital_id
    
    analysis = AnalysisHistory(
        user_id=current_user.id,
        hospital_id=hospital_id,
        image_type=image_type,
        original_filename=original_filename,
        processed_filename=processed_filename,
        detections=detections,
        notes=notes
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    
    return {"message": "Analysis recorded", "analysis_id": analysis.id}


@app.get("/analysis/history")
def get_analysis_history(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's analysis history"""
    analyses = db.query(AnalysisHistory).filter(
        AnalysisHistory.user_id == current_user.id
    ).order_by(AnalysisHistory.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            "id": a.id,
            "image_type": a.image_type,
            "original_filename": a.original_filename,
            "processed_filename": a.processed_filename,
            "detections": a.detections,
            "created_at": a.created_at.isoformat(),
            "notes": a.notes
        }
        for a in analyses
    ]


# ============ Public Endpoints ============

@app.get("/hospitals/list")
def get_hospitals_list(db: Session = Depends(get_db)):
    """Get list of active hospitals for signup dropdown (public endpoint)"""
    hospitals = db.query(HospitalEntity).filter(HospitalEntity.is_active == True).order_by(HospitalEntity.name).all()
    return [
        {
            "id": h.id,
            "name": h.name,
            "code": h.code
        }
        for h in hospitals
    ]


# ============ Contact Form ============

class ContactInput(BaseModel):
    name: str
    email: EmailStr
    organization: Optional[str] = None
    reason: Optional[str] = None
    message: str


@app.post("/contact")
def submit_contact(data: ContactInput, db: Session = Depends(get_db)):
    """Public endpoint: store a message submitted through the Contact form."""
    name = (data.name or "").strip()
    message = (data.message or "").strip()
    if not name or not message:
        raise HTTPException(status_code=400, detail="Name and message are required")

    entry = ContactMessage(
        name=name,
        email=data.email,
        organization=(data.organization or "").strip() or None,
        reason=(data.reason or "").strip() or None,
        message=message,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"message": "Message received", "id": entry.id}


@app.get("/contacts")
def list_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin-only: list submitted contact messages (newest first)."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    rows = db.query(ContactMessage).order_by(ContactMessage.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "email": r.email,
            "organization": r.organization,
            "reason": r.reason,
            "message": r.message,
            "is_read": r.is_read,
            # Stored as UTC; append 'Z' so the browser renders correct local time.
            "created_at": (r.created_at.isoformat() + "Z") if r.created_at else None,
        }
        for r in rows
    ]


@app.get("/")
def read_root():
    return {
        "message": "Welcome to Wrist Fracture and Metal Detection System API",
        "version": "2.0"
    }
