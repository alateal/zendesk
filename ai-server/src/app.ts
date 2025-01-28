import express from 'express';
import cors from 'cors';
import { config } from './config/environment';
import { aiRoutes } from './routes/ai.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/ai', aiRoutes);

app.listen(config.port, () => {
  console.log(`AI Server running on port ${config.port}`);
});

export default app;