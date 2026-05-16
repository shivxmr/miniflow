# **AI \+ Full-Stack Coding Project**

## **Objective**

Build a lightweight project management platform inspired by Asana/Trello that demonstrates:

* Full-stack engineering capability  
* Proper authentication & authorization  
* Al-assisted development workflow  
* Product thinking  
* Database design  
* API design  
* UI/UX execution  
* Deployment readiness

The goal is not to build a production-grade Asana clone, but to evaluate:

1. Engineering quality  
2. Ability to use Al tools effectively  
3. Prioritization under time constraints  
4. Security fundamentals  
5. Product instincts  
6. Code organization and maintainability

## **Project Overview**

**Problem Statement:** Your task is to build a lightweight collaborative project management platform inspired by tools like Asana and Trello. 

Modern organizations manage work across multiple teams, projects, and stakeholders. As companies scale, they need a centralized platform where users can

* Organize projects   
* Create and assign tasks   
* Track execution progress   
* Collaborate securely   
* Control access based on user roles

The objective is not to recreate the full complexity of enterprise project management tools, but to design and build a clean, secure, and functional MVP that demonstrates strong engineering fundamentals. 

The platform should simulate a real-world SaaS application where multiple users interact with shared projects while respecting authentication and authorization boundaries.

This is designed to evaluate both engineering execution and product thinking under time constraints. 

We are specifically looking for: 

* Ability to architect a full-stack application   
* Understanding of authentication and role-based authorization   
* API and database design skills   
* Ability to ship quickly using AI-assisted development   
* Clean and maintainable code structure   
* Good UX and workflow decisions   
* Engineering judgment and prioritization 

The system should allow users to: 

* Create and manage projects   
* Invite or manage users   
* Create and assign tasks   
* Track task status   
* View work in an organized dashboard   
* Restrict actions based on permissions/roles 

The project should feel like a simplified but realistic collaboration platform that could be extended into a larger SaaS product.

* **Product Name:** MiniFlow (working title)  
* **Time Constraint:** Total Time: 2 Days | Expected Effort: 10-16 hours

## **Required Features**

### **1\. Authentication (Mandatory)**

* **Functional Requirements:** User signup, login, logout, password hashing, JWT/session-based authentication, protected routes.  
* **Expected Security Standards:** Passwords must NOT be stored in plain text (Use bcrypt/argon2), secure token handling, basic validation, prevent unauthorized API access.  
* **Bonus:** Refresh tokens, OAuth (Google/GitHub), Email verification, Forgot password flow.

### **2\. Authorization / RBAC (Mandatory)**

Implement role-based access control. The authorization logic should exist in Backend APIs and Middleware (Not just frontend hiding).

| Role | Permissions |
| :---- | :---- |
| **Admin** | Create projects, Add/remove users, Edit all tasks, Delete tasks, Change roles. |
| **Member** | View assigned projects, Create tasks, Update own tasks, Comment on tasks. |
| **Viewer** | Only view projects/tasks. |

### **3\. Project Management Features**

* **Projects:** Create, edit, delete, and view all projects the user has access to.  
* **Tasks:** Support Title, Description, Priority, Status, Due date, Assigned user, and Created by.  
* **Task Statuses:** Todo, In Progress, Done.

### **4\. Dashboard UI**

Build a clean modern UI.

* **Auth Pages:** Login, Signup  
* **Main App:** Dashboard, Project page, Task board/list, Task creation modal/form  
* **UI Expectations:** Responsive design, Proper loading states, Empty states, Error handling

## **API Design**

`Auth`  
`• POST /signup`  
`• POST /login`  
`• GET /me`

`Projects`  
`• GET /projects`  
`• POST /projects`  
`• PUT /projects/:id`  
`• DELETE /projects/:id`

`Tasks`  
`• GET /projects/:id/tasks`  
`• POST /tasks`  
`• PUT /tasks/:id`  
`• DELETE /tasks/:id`

## **Database Design**

Suggested tables and schemas:

| Table | Columns |
| :---- | :---- |
| **users** | id, name, email, password\_hash, role, created\_at |
| **projects** | id, name, description, created\_by |
| **project\_members** | project\_id, user\_id, role |
| **tasks** | id, project\_id, title, description, assigned\_to, status, priority, due\_date, created\_by |

## **Recommended Tech Stack**

* **Frontend:** [Next.js](http://Next.js)  
* **Backend:** FastAPI  
* **Database:** PostgreSQL  
* **Auth:** JWT, NextAuth, Clerk, Supabase Auth, Firebase Auth  
* **Deployment:** Vercel

## **AI Usage Requirements**

The developer MUST document:

1. **AI Tools Used:** e.g., Cursor, ChatGPT, Claude, Copilot.  
2. **What AI Helped With:** e.g., Boilerplate generation, API creation, Debugging, UI generation, SQL schema generation.  
3. **What Was Manually Fixed:** We want to evaluate whether they blindly copy-pasted or actually understood the code.

## **Deliverables**

1. **GitHub Repository:** Must include proper commits, README, and setup instructions.  
2. **Working Demo:** Deploy online if possible.  
3. **Architecture Notes:** Short document covering tech stack choices, authentication approach, authorization design, database schema, AI tools used, and tradeoffs made.  
4. **Loom Video (5-10 mins):** Walkthrough covering product demo, architecture, AI usage, and challenges faced.

## **Evaluation Rubric**

* **1\. Authentication & Security (25%):** Password handling, Protected APIs, Token management, Middleware quality, Authorization correctness.  
* **2\. Code Quality (20%):** Folder structure, Naming conventions, Readability, Reusability, Error handling.  
* **3\. Product Thinking (15%):** UX decisions, Prioritization, Feature completeness, Workflow usability.  
* **4\. AI Usage Effectiveness (15%):** Smart use of AI, Ability to modify AI-generated code, Debugging capability, Engineering judgment.  
* **5\. Backend Architecture (15%):** API design, Database modeling, Separation of concerns, Middleware structure.  
* **6\. Frontend Execution (10%):** Responsiveness, State handling, UX polish, Component structure.

## **Bonus Features (Optional)**

**Easy Bonuses:** Drag-and-drop Kanban board, Dark mode, Activity logs, Comments on tasks, Search/filter, File uploads.  
**Advanced Bonuses:** WebSockets/realtime updates, Notifications, AI task summarization, AI sprint planning, AI-generated task breakdowns, Multi-tenant architecture.

## **Optional Advanced Twist**

Add ONE AI feature (e.g., "Generate subtasks using AI", "Summarize project progress", "Convert plain English into tasks"). This helps test API integration, Prompt engineering, AI workflow understanding, and Practical AI product thinking.

## **Final Instructions**

Build a lightweight project management platform inspired by Asana/Trello. You are free to use any AI tools. Focus on Authentication, Authorization, Clean architecture, Functional product, and Good engineering judgment. The project does NOT need to be perfect. Prioritize shipping a clean, secure, well-structured MVP within 2 days. Document your decisions and tradeoffs clearly.