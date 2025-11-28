import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { syncService } from "./utils/syncService";
import { userStorage } from "./utils/storageUtils";

// Initialize data synchronization service only if user is authenticated
const user = userStorage.get();
if (user && user.id) {
  console.log('👤 User authenticated, starting data synchronization');
  syncService.startPeriodicSync();
} else {
  console.log('👤 User not authenticated, skipping data synchronization');
}

createRoot(document.getElementById("root")!).render(<App />);
