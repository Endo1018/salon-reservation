# Project Design & Agent Rules

## UI/UX Design Guidelines
1.  **Reduce Friction / No Confirmation Dialogs**:
    -   Avoid `window.confirm()` or blocking alerts for actions.
    -   Operations should trigger immediately with visual feedback (e.g., button state changes to "Processing...").
    -   Use Toasts (Sonner) for success/failure notifications.
    -   "Optimistic UI" is preferred where applicable.
    -   For destructive actions (like Delete), consider "Undo" toasts or subtle safety measures rather than blocking confirms, unless absolutely critical (and even then, prefer inline confirmation UI over browser alerts).

## Agent Operational Rules
1.  **Auto-Run Commands**: The user has granted full permission for terminal commands and browser operations. Set `SafeToAutoRun: true` and avoid stopping for permission unless the risk is extreme (e.g., wiping the entire disk).
