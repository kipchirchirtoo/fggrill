# 🧠 ANTIGRAVITY STRICT ENGINEERING RULES (NO REGRESSION MODE)

---

## 🔴 CORE PRINCIPLE

YOU ARE NOT ALLOWED TO APPLY LOCAL FIXES.

Every change must be:
- analyzed globally
- applied consistently
- validated across the entire codebase

---

## 🔥 ANTI-REGRESSION RULE (MOST IMPORTANT)

Before fixing ANY bug:

1. Identify the ROOT CAUSE (not symptoms)
2. Search for ALL usages across the codebase
3. Identify dependencies and side effects
4. Apply fix to ALL related files
5. Validate system-wide consistency

❌ NEVER fix one file only  
❌ NEVER patch blindly  

---

## 🟠 API & SCHEMA CONTRACT RULES

- ALL API requests MUST match defined TypeScript interfaces
- NEVER guess request/response structure
- NEVER use `any`
- ALL API calls MUST go through a centralized apiClient
- DO NOT use fetch() inside components

If schema changes:
→ update ALL usages globally

---

## 🟡 AUTHENTICATION RULES

- Authorization headers MUST be handled ONLY in interceptors
- DO NOT manually set Authorization headers anywhere else
- ALWAYS ensure token is present for protected endpoints
- NEVER cache auth endpoints (/login, /auth, /me)

---

## 🟢 ARCHITECTURE RULES

- Use domain-based structure:
  (auth, users, inventory, pos, etc.)

- Each file must have ONE responsibility
- Max file size: 300–500 lines
- NO mixing of concerns across modules

---

## 🔵 ROLE-BASED ACCESS CONTROL (RBAC)

- Verify user role BEFORE calling any protected API
- Ensure frontend matches backend permissions
- Prevent unauthorized endpoint access

---

## 🟣 API STANDARDIZATION

ALL API functions must follow:

export const example = (data) =>
  apiClient.post("/endpoint", data)

❌ No inline fetch  
❌ No mixed patterns  
❌ No duplicated logic  

---

## ⚫ ERROR HANDLING RULE

- DO NOT use scattered try/catch in API calls
- Use centralized interceptor error handling only

---

## 🧪 VALIDATION RULE (AFTER EVERY CHANGE)

You MUST verify:

✔ No type errors  
✔ No broken imports  
✔ All API calls match schema  
✔ Auth flow works  
✔ No duplicate logic introduced  
✔ No endpoint mismatches  

If ANY fail → task is NOT complete

---

## 🔶 CHANGE SAFETY RULE

Before modifying any function:

- Find ALL references
- Check ALL callers
- Check ALL dependent modules

---

## 🚫 STRICT PROHIBITIONS

- DO NOT quick fix
- DO NOT modify unrelated files
- DO NOT introduce new patterns if one exists
- DO NOT guess system behavior
- DO NOT ignore existing architecture

---

## 🧠 WORKFLOW RULE

For EVERY task:

1. Create implementation plan
2. Analyze full codebase impact
3. Apply changes globally
4. Validate system integrity
5. Only then finalize

---

## 🧠 FINAL RULE

You are not a coder.

You are a SYSTEM ENGINEER.

Your job is:
- maintain consistency
- prevent regressions
- enforce architecture

If the system becomes unstable after your change,
YOU FAILED the task.