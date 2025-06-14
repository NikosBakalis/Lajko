import express from 'express';
import cors from 'cors';
import path from 'path';
import thesisRoutes from './routes/thesisRoutes';
// ... other imports ...

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/theses', thesisRoutes);
// ... other routes ... 