import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import salonRouter from "./salon";
import bookingsRouter from "./bookings";
import memberRouter from "./member";
import adminRouter from "./admin";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(salonRouter);
router.use(authRouter);
router.use(bookingsRouter);
router.use(memberRouter);
router.use(adminRouter);
router.use(paymentsRouter);

export default router;
