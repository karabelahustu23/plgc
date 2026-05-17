import { Router, type IRouter } from "express";
import healthRouter from "./health";
import esimRouter from "./esim";
import walletRouter from "./wallet";
import ordersRouter from "./orders";
import familyRouter from "./family";
import referralRouter from "./referral";
import redeemRouter from "./redeem";
import supportRouter from "./support";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(esimRouter);
router.use(walletRouter);
router.use(ordersRouter);
router.use(familyRouter);
router.use(referralRouter);
router.use(redeemRouter);
router.use(supportRouter);
router.use(adminRouter);

export default router;
