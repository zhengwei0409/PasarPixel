import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
    listNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
} from "../controllers/notification.controller";

const router = Router();

router.use(authenticate);

router.get("/", listNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);

export default router;
