import { Router, type IRouter } from "express";
import healthRouter from "./health";
import minecraftBotRouter from "./minecraft-bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(minecraftBotRouter);

export default router;
