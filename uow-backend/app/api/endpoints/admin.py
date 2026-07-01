"""
Admin API Endpoints
--------------------
Full system management for admin users:
- User management (CRUD for all users)
- Hospital management (CRUD for hospitals)
- Client-Hospital assignments
- Password management
- Analytics
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

router = APIRouter()


# ============ Pydantic Schemas ============

class UserListItem(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserDetail(BaseModel):
    id: int
    email: str
    name: Optional[str]
    role: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime]
    profile: Optional[dict] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    status: Optional[str] = "active"
    # Client fields
    client_id: Optional[str] = None
    organization: Optional[str] = None
    # Hospital staff fields
    hospital_entity_id: Optional[int] = None
    staff_id: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    # Admin fields
    admin_id: Optional[str] = None
    access_level: Optional[str] = "full"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None


class PasswordChange(BaseModel):
    new_password: str


class HospitalCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class HospitalListItem(BaseModel):
    id: int
    name: str
    code: str
    email: Optional[str]
    is_active: bool
    staff_count: int
    client_count: int

    class Config:
        from_attributes = True


class ClientAssignment(BaseModel):
    client_id: int  # This is the client_profiles.id
    hospital_id: int
    notes: Optional[str] = None


class DashboardStats(BaseModel):
    total_users: int
    total_clients: int
    total_hospitals: int
    total_admins: int
    total_hospital_entities: int
    total_analyses: int
    active_users: int
    inactive_users: int


# ============ Dependency Imports ============
# These will be imported from main.py

def get_admin_endpoints(get_db, get_current_user, get_password_hash, User, ClientProfile, 
                        HospitalEntity, HospitalStaff, HospitalClient, AdminProfile, AnalysisHistory):
    """
    Factory function to create admin endpoints with dependencies injected.
    This pattern allows us to avoid circular imports.
    """
    
    # ============ Admin Authorization ============
    
    def require_admin(current_user: User = Depends(get_current_user)):
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        return current_user
    
    # ============ Dashboard & Analytics ============
    
    @router.get("/dashboard/stats", response_model=DashboardStats)
    def get_dashboard_stats(
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Get dashboard statistics"""
        total_users = db.query(User).count()
        total_clients = db.query(User).filter(User.role == "client").count()
        total_hospitals = db.query(User).filter(User.role == "hospital").count()
        total_admins = db.query(User).filter(User.role == "admin").count()
        total_hospital_entities = db.query(HospitalEntity).count()
        total_analyses = db.query(AnalysisHistory).count()
        active_users = db.query(User).filter(User.status == "active").count()
        inactive_users = db.query(User).filter(User.status != "active").count()
        
        return DashboardStats(
            total_users=total_users,
            total_clients=total_clients,
            total_hospitals=total_hospitals,
            total_admins=total_admins,
            total_hospital_entities=total_hospital_entities,
            total_analyses=total_analyses,
            active_users=active_users,
            inactive_users=inactive_users
        )
    
    # ============ User Management ============
    
    @router.get("/users", response_model=List[UserListItem])
    def list_users(
        role: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """List all users with optional filters"""
        query = db.query(User)
        
        if role:
            query = query.filter(User.role == role)
        if status:
            query = query.filter(User.status == status)
        if search:
            query = query.filter(
                or_(
                    User.email.ilike(f"%{search}%"),
                    User.name.ilike(f"%{search}%")
                )
            )
        
        users = query.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
        return users
    
    @router.get("/users/{user_id}", response_model=UserDetail)
    def get_user(
        user_id: int,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Get detailed user information"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        profile = None
        if user.role == "client":
            client = db.query(ClientProfile).filter(ClientProfile.user_id == user.id).first()
            if client:
                profile = {
                    "client_id": client.client_id,
                    "organization": client.organization,
                    "phone": client.phone,
                    "address": client.address
                }
        elif user.role == "hospital":
            staff = db.query(HospitalStaff).filter(HospitalStaff.user_id == user.id).first()
            if staff:
                hospital = db.query(HospitalEntity).filter(HospitalEntity.id == staff.hospital_id).first()
                profile = {
                    "staff_id": staff.staff_id,
                    "department": staff.department,
                    "position": staff.position,
                    "hospital_name": hospital.name if hospital else None,
                    "hospital_id": staff.hospital_id
                }
        elif user.role == "admin":
            admin_profile = db.query(AdminProfile).filter(AdminProfile.user_id == user.id).first()
            if admin_profile:
                profile = {
                    "admin_id": admin_profile.admin_id,
                    "department": admin_profile.department,
                    "access_level": admin_profile.access_level
                }
        
        return UserDetail(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            status=user.status,
            created_at=user.created_at,
            updated_at=user.updated_at,
            profile=profile
        )
    
    @router.post("/users", status_code=status.HTTP_201_CREATED)
    def create_user(
        user_data: UserCreate,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Create a new user (admin only)"""
        # Enforce a minimum password so users can't be created without one
        if len((user_data.password or "").strip()) < 8:
            raise HTTPException(
                status_code=400,
                detail="Password must be at least 8 characters long"
            )

        # Check if email exists
        existing = db.query(User).filter(User.email == user_data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create user
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            name=user_data.name,
            role=user_data.role,
            status=user_data.status or "active"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Create role-specific profile
        try:
            if user_data.role == "client":
                profile = ClientProfile(
                    user_id=new_user.id,
                    client_id=user_data.client_id or f"CLT-{new_user.id:06d}",
                    organization=user_data.organization
                )
                db.add(profile)
            elif user_data.role == "hospital":
                if not user_data.hospital_entity_id:
                    raise HTTPException(status_code=400, detail="Hospital entity ID required for hospital staff")
                profile = HospitalStaff(
                    user_id=new_user.id,
                    hospital_id=user_data.hospital_entity_id,
                    staff_id=user_data.staff_id or f"HSP-{new_user.id:06d}",
                    department=user_data.department,
                    position=user_data.position
                )
                db.add(profile)
            elif user_data.role == "admin":
                profile = AdminProfile(
                    user_id=new_user.id,
                    admin_id=user_data.admin_id or f"ADM-{new_user.id:06d}",
                    department=user_data.department,
                    access_level=user_data.access_level or "full"
                )
                db.add(profile)
            
            db.commit()
        except Exception as e:
            db.delete(new_user)
            db.commit()
            raise HTTPException(status_code=400, detail=f"Failed to create profile: {str(e)}")
        
        return {"message": "User created successfully", "user_id": new_user.id}
    
    @router.put("/users/{user_id}")
    def update_user(
        user_id: int,
        user_data: UserUpdate,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Update user information"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent admin from deactivating themselves
        if user.id == admin.id and user_data.status == "inactive":
            raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
        
        if user_data.email:
            existing = db.query(User).filter(User.email == user_data.email, User.id != user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email already in use")
            user.email = user_data.email
        
        if user_data.name is not None:
            user.name = user_data.name
        if user_data.status:
            user.status = user_data.status
        
        db.commit()
        return {"message": "User updated successfully"}
    
    @router.put("/users/{user_id}/password")
    def change_user_password(
        user_id: int,
        password_data: PasswordChange,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Change a user's password (admin only)"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.hashed_password = get_password_hash(password_data.new_password)
        db.commit()
        return {"message": "Password changed successfully"}
    
    @router.delete("/users/{user_id}")
    def delete_user(
        user_id: int,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Delete a user"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Prevent admin from deleting themselves
        if user.id == admin.id:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
        db.delete(user)
        db.commit()
        return {"message": "User deleted successfully"}
    
    # ============ Hospital Entity Management ============
    
    @router.get("/hospitals", response_model=List[HospitalListItem])
    def list_hospitals(
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """List all hospital entities"""
        query = db.query(HospitalEntity)
        
        if is_active is not None:
            query = query.filter(HospitalEntity.is_active == is_active)
        if search:
            query = query.filter(
                or_(
                    HospitalEntity.name.ilike(f"%{search}%"),
                    HospitalEntity.code.ilike(f"%{search}%")
                )
            )
        
        hospitals = query.order_by(HospitalEntity.name).offset(skip).limit(limit).all()
        
        result = []
        for h in hospitals:
            staff_count = db.query(HospitalStaff).filter(HospitalStaff.hospital_id == h.id).count()
            client_count = db.query(HospitalClient).filter(
                HospitalClient.hospital_id == h.id, 
                HospitalClient.is_active == True
            ).count()
            result.append(HospitalListItem(
                id=h.id,
                name=h.name,
                code=h.code,
                email=h.email,
                is_active=h.is_active,
                staff_count=staff_count,
                client_count=client_count
            ))
        
        return result
    
    @router.get("/hospitals/{hospital_id}")
    def get_hospital(
        hospital_id: int,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Get detailed hospital information"""
        hospital = db.query(HospitalEntity).filter(HospitalEntity.id == hospital_id).first()
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        # Get staff list
        staff = db.query(HospitalStaff).filter(HospitalStaff.hospital_id == hospital_id).all()
        staff_list = []
        for s in staff:
            user = db.query(User).filter(User.id == s.user_id).first()
            staff_list.append({
                "id": s.id,
                "user_id": s.user_id,
                "name": user.name if user else None,
                "email": user.email if user else None,
                "staff_id": s.staff_id,
                "department": s.department,
                "position": s.position
            })
        
        # Get assigned clients
        assignments = db.query(HospitalClient).filter(
            HospitalClient.hospital_id == hospital_id,
            HospitalClient.is_active == True
        ).all()
        clients_list = []
        for a in assignments:
            client = db.query(ClientProfile).filter(ClientProfile.id == a.client_id).first()
            if client:
                user = db.query(User).filter(User.id == client.user_id).first()
                clients_list.append({
                    "assignment_id": a.id,
                    "client_profile_id": client.id,
                    "user_id": client.user_id,
                    "name": user.name if user else None,
                    "email": user.email if user else None,
                    "client_id": client.client_id,
                    "assigned_at": a.assigned_at,
                    "notes": a.notes
                })
        
        return {
            "id": hospital.id,
            "name": hospital.name,
            "code": hospital.code,
            "address": hospital.address,
            "phone": hospital.phone,
            "email": hospital.email,
            "is_active": hospital.is_active,
            "created_at": hospital.created_at,
            "staff": staff_list,
            "clients": clients_list
        }
    
    @router.post("/hospitals", status_code=status.HTTP_201_CREATED)
    def create_hospital(
        hospital_data: HospitalCreate,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Create a new hospital entity"""
        existing = db.query(HospitalEntity).filter(HospitalEntity.code == hospital_data.code).first()
        if existing:
            raise HTTPException(status_code=400, detail="Hospital code already exists")
        
        hospital = HospitalEntity(
            name=hospital_data.name,
            code=hospital_data.code,
            address=hospital_data.address,
            phone=hospital_data.phone,
            email=hospital_data.email
        )
        db.add(hospital)
        db.commit()
        db.refresh(hospital)
        
        return {"message": "Hospital created successfully", "hospital_id": hospital.id}
    
    @router.put("/hospitals/{hospital_id}")
    def update_hospital(
        hospital_id: int,
        hospital_data: HospitalUpdate,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Update hospital information"""
        hospital = db.query(HospitalEntity).filter(HospitalEntity.id == hospital_id).first()
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        if hospital_data.code:
            existing = db.query(HospitalEntity).filter(
                HospitalEntity.code == hospital_data.code,
                HospitalEntity.id != hospital_id
            ).first()
            if existing:
                raise HTTPException(status_code=400, detail="Hospital code already in use")
            hospital.code = hospital_data.code
        
        if hospital_data.name is not None:
            hospital.name = hospital_data.name
        if hospital_data.address is not None:
            hospital.address = hospital_data.address
        if hospital_data.phone is not None:
            hospital.phone = hospital_data.phone
        if hospital_data.email is not None:
            hospital.email = hospital_data.email
        if hospital_data.is_active is not None:
            hospital.is_active = hospital_data.is_active
        
        db.commit()
        return {"message": "Hospital updated successfully"}
    
    @router.delete("/hospitals/{hospital_id}")
    def delete_hospital(
        hospital_id: int,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Delete a hospital entity"""
        hospital = db.query(HospitalEntity).filter(HospitalEntity.id == hospital_id).first()
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        # Check if hospital has staff
        staff_count = db.query(HospitalStaff).filter(HospitalStaff.hospital_id == hospital_id).count()
        if staff_count > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete hospital with {staff_count} staff members. Remove staff first."
            )
        
        db.delete(hospital)
        db.commit()
        return {"message": "Hospital deleted successfully"}
    
    # ============ Client-Hospital Assignment ============
    
    @router.post("/assignments")
    def assign_client_to_hospital(
        assignment_data: ClientAssignment,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Assign a client to a hospital"""
        # Verify client exists
        client = db.query(ClientProfile).filter(ClientProfile.id == assignment_data.client_id).first()
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        
        # Verify hospital exists
        hospital = db.query(HospitalEntity).filter(HospitalEntity.id == assignment_data.hospital_id).first()
        if not hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        # Check if assignment already exists
        existing = db.query(HospitalClient).filter(
            HospitalClient.client_id == assignment_data.client_id,
            HospitalClient.hospital_id == assignment_data.hospital_id,
            HospitalClient.is_active == True
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Client is already assigned to this hospital")
        
        assignment = HospitalClient(
            hospital_id=assignment_data.hospital_id,
            client_id=assignment_data.client_id,
            assigned_by=admin.id,
            notes=assignment_data.notes
        )
        db.add(assignment)
        db.commit()
        
        return {"message": "Client assigned to hospital successfully"}
    
    @router.delete("/assignments/{assignment_id}")
    def remove_client_from_hospital(
        assignment_id: int,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Remove a client from a hospital"""
        assignment = db.query(HospitalClient).filter(HospitalClient.id == assignment_id).first()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        assignment.is_active = False
        db.commit()
        
        return {"message": "Client removed from hospital successfully"}
    
    @router.get("/clients/unassigned")
    def get_unassigned_clients(
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Get list of clients not assigned to any hospital"""
        # Get all client profile IDs that have active assignments
        assigned_ids = db.query(HospitalClient.client_id).filter(
            HospitalClient.is_active == True
        ).distinct().all()
        assigned_ids = [id[0] for id in assigned_ids]
        
        # Get clients without assignments
        query = db.query(ClientProfile)
        if assigned_ids:
            query = query.filter(~ClientProfile.id.in_(assigned_ids))
        
        unassigned = query.all()
        
        result = []
        for client in unassigned:
            user = db.query(User).filter(User.id == client.user_id).first()
            result.append({
                "client_profile_id": client.id,
                "user_id": client.user_id,
                "client_id": client.client_id,
                "name": user.name if user else None,
                "email": user.email if user else None,
                "organization": client.organization
            })
        
        return result
    
    @router.get("/clients/all")
    def get_all_clients_with_assignments(
        search: Optional[str] = None,
        hospital_filter: Optional[int] = None,
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Get all clients with their hospital assignments"""
        # Get all client profiles
        query = db.query(ClientProfile)
        clients = query.offset(skip).limit(limit).all()
        
        result = []
        for client in clients:
            user = db.query(User).filter(User.id == client.user_id).first()
            if not user:
                continue
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                if not (
                    (user.name and search_lower in user.name.lower()) or
                    search_lower in user.email.lower() or
                    search_lower in client.client_id.lower()
                ):
                    continue
            
            # Get active assignments
            assignments = db.query(HospitalClient).filter(
                HospitalClient.client_id == client.id,
                HospitalClient.is_active == True
            ).all()
            
            assigned_hospitals = []
            for assignment in assignments:
                hospital = db.query(HospitalEntity).filter(HospitalEntity.id == assignment.hospital_id).first()
                if hospital:
                    # Apply hospital filter
                    if hospital_filter and hospital.id != hospital_filter:
                        continue
                    assigned_hospitals.append({
                        "assignment_id": assignment.id,
                        "hospital_id": hospital.id,
                        "hospital_name": hospital.name,
                        "hospital_code": hospital.code,
                        "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None
                    })
            
            # If hospital filter is set and client has no matching assignments, skip
            if hospital_filter and not assigned_hospitals:
                continue
            
            result.append({
                "client_profile_id": client.id,
                "user_id": client.user_id,
                "client_id": client.client_id,
                "name": user.name,
                "email": user.email,
                "organization": client.organization,
                "status": user.status,
                "assigned_hospitals": assigned_hospitals
            })
        
        return result
    
    @router.put("/assignments/{assignment_id}")
    def update_assignment(
        assignment_id: int,
        new_hospital_id: int,
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """Reassign a client to a different hospital"""
        assignment = db.query(HospitalClient).filter(HospitalClient.id == assignment_id).first()
        if not assignment:
            raise HTTPException(status_code=404, detail="Assignment not found")
        
        # Verify new hospital exists
        new_hospital = db.query(HospitalEntity).filter(HospitalEntity.id == new_hospital_id).first()
        if not new_hospital:
            raise HTTPException(status_code=404, detail="Hospital not found")
        
        # Check if client is already assigned to the new hospital
        existing = db.query(HospitalClient).filter(
            HospitalClient.client_id == assignment.client_id,
            HospitalClient.hospital_id == new_hospital_id,
            HospitalClient.is_active == True,
            HospitalClient.id != assignment_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Client is already assigned to this hospital")
        
        # Update assignment
        assignment.hospital_id = new_hospital_id
        assignment.assigned_by = admin.id
        db.commit()
        
        return {"message": "Assignment updated successfully"}
    
    # ============ Analysis History ============
    
    @router.get("/analyses")
    def list_analyses(
        user_id: Optional[int] = None,
        hospital_id: Optional[int] = None,
        image_type: Optional[str] = None,
        skip: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
        db: Session = Depends(get_db),
        admin: User = Depends(require_admin)
    ):
        """List all analyses"""
        query = db.query(AnalysisHistory)

        if user_id:
            query = query.filter(AnalysisHistory.user_id == user_id)
        if hospital_id:
            # Hospital-wise: include analyses tagged with this hospital AND analyses
            # made by users tied to it (its staff + its assigned clients), so a
            # client's uploads show under their hospital too.
            assigned_profile_ids = [
                hc.client_id for hc in db.query(HospitalClient).filter(
                    HospitalClient.hospital_id == hospital_id,
                    HospitalClient.is_active == True,
                ).all()
            ]
            client_user_ids = [
                cp.user_id for cp in db.query(ClientProfile).filter(
                    ClientProfile.id.in_(assigned_profile_ids)
                ).all()
            ] if assigned_profile_ids else []
            staff_user_ids = [
                hs.user_id for hs in db.query(HospitalStaff).filter(
                    HospitalStaff.hospital_id == hospital_id
                ).all()
            ]
            related_user_ids = list(set(client_user_ids + staff_user_ids))
            conditions = [AnalysisHistory.hospital_id == hospital_id]
            if related_user_ids:
                conditions.append(AnalysisHistory.user_id.in_(related_user_ids))
            query = query.filter(or_(*conditions))
        if image_type:
            query = query.filter(AnalysisHistory.image_type == image_type)

        analyses = query.order_by(AnalysisHistory.created_at.desc()).offset(skip).limit(limit).all()

        result = []
        for a in analyses:
            user = db.query(User).filter(User.id == a.user_id).first()
            hospital_name = None
            if a.hospital_id:
                h = db.query(HospitalEntity).filter(HospitalEntity.id == a.hospital_id).first()
                hospital_name = h.name if h else None
            # The report PDF is written next to the processed image, so its path
            # is derivable without an extra DB column.
            report_filename = None
            if a.processed_filename:
                report_filename = a.processed_filename.replace("_processed.png", "_report.pdf")
            result.append({
                "id": a.id,
                "user_id": a.user_id,
                "user_name": user.name if user else None,
                "user_email": user.email if user else None,
                "hospital_id": a.hospital_id,
                "hospital_name": hospital_name,
                "image_type": a.image_type,
                "original_filename": a.original_filename,
                "processed_filename": a.processed_filename,
                "report_filename": report_filename,
                "detections": a.detections,
                # Stored as UTC; append 'Z' so the browser renders correct local time.
                "created_at": (a.created_at.isoformat() + "Z") if a.created_at else None,
            })

        return result
