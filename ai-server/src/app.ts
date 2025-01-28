import express from 'express';
import cors from 'cors';
import { config } from './config/environment';
import { aiRoutes } from './routes/ai.routes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/ai', aiRoutes);

const port = config.port;

app.listen(port, () => {
  console.log(`AI Server is running on port ${port}`);
});

export default app;