# FG Grill: Offline System Installation Guide

This guide provides step-by-step instructions for deploying the **Offline Gateway** and installing the **Standalone Terminal Software**.

---

## 1. Local Gateway Setup (Server PC Only)
The "Server PC" acts as the central hub for the restaurant's network. It must stay on and be connected to the terminals.

1.  **Install Docker Desktop**: Ensure Docker is installed and running on the Server PC.
2.  **Start the Gateway**:
    *   Open a terminal in the `fggrill` folder.
    *   Run: `docker-compose -f docker-compose.offline.yml up -d`
3.  **Verify**: Open a browser on the Server PC and go to `http://localhost:5432` to ensure the database is active.

---

## 2. Installing Terminal Software (Staff PCs)
Follow these steps for every computer used by Cashiers, Waiters, or Bar staff.

1.  **Locate the Installer**: 
    *   Go to `c:\Users\user\Desktop\fggrill\dist-electron`.
    *   Find the file: **`FG Grill Terminal Setup 1.0.0.exe`**.
2.  **Run the Installer**:
    *   Copy this file to the target computer via a flash drive.
    *   Double-click to run. Follow the prompts to install.
3.  **Configure Network**:
    *   Ensure the Terminal PC is on the same Wi-Fi/LAN as the Server PC.
    *   The software will automatically attempt to connect to the Server PC at `http://[SERVER-IP]:5000`.

---

## 3. Using the Terminal
1.  **Open the App**: Launch "FG Grill Terminal" from the Desktop shortcut.
2.  **Login**: Use the touch-screen PIN pad.
    *   **Restaurant Staff**: Enter PIN starting with **R** (e.g., `R101`).
    *   **Bar Staff**: Enter PIN starting with **B** (e.g., `B201`).
    *   **Cashier/Accounts**: Enter your assigned 4-digit numeric PIN.
3.  **Offline Use**: If the internet goes out, the terminal will stay online via the local gateway. Sync will happen automatically when internet returns.

---

## 4. Maintenance & Support
*   **Sync Agent**: The `offline-sync-agent.py` must be running on the Server PC to push data to Supabase.
*   **Database Backup**: The local database is stored in the Docker volume. Do not delete Docker volumes unless performing a full reset.

> [!IMPORTANT]
> Always ensure the Server PC is powered on BEFORE opening the Terminal Software on other computers.
