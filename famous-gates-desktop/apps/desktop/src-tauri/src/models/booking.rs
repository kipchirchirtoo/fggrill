use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Booking {
    pub id: String,
    pub confirmation_number: String,
    pub guest_name: String,
    pub room_id: String,
    pub check_in: String,
    pub check_out: String,
    pub status: String,
    pub branch_id: i64,
    pub total_amount: f64,
    pub created_at: String,
    pub updated_at: String,
}
