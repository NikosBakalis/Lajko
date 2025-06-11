import React, { useEffect, useState } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  TextField, 
  Button, 
  List, 
  ListItem, 
  ListItemText,
  Paper,
  AppBar,
  Toolbar
} from '@mui/material';
import { userApi, taskApi, User, Task } from './services/api';

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newUser, setNewUser] = useState({ email: '', name: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', userId: 1, completed: false });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersResponse, tasksResponse] = await Promise.all([
        userApi.getAll(),
        taskApi.getAll()
      ]);
      setUsers(usersResponse.data);
      setTasks(tasksResponse.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await userApi.create(newUser);
      setNewUser({ email: '', name: '' });
      loadData();
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await taskApi.create(newTask);
      setNewTask({ title: '', description: '', userId: 1, completed: false });
      loadData();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Task Manager
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Create User
          </Typography>
          <form onSubmit={handleCreateUser}>
            <TextField
              fullWidth
              label="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              margin="normal"
            />
            <Button type="submit" variant="contained" sx={{ mt: 2 }}>
              Create User
            </Button>
          </form>
        </Paper>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Create Task
          </Typography>
          <form onSubmit={handleCreateTask}>
            <TextField
              fullWidth
              label="Title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              margin="normal"
            />
            <TextField
              fullWidth
              label="Description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              margin="normal"
            />
            <Button type="submit" variant="contained" sx={{ mt: 2 }}>
              Create Task
            </Button>
          </form>
        </Paper>

        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Users
          </Typography>
          <List>
            {users.map((user) => (
              <ListItem key={user.id}>
                <ListItemText
                  primary={user.name}
                  secondary={user.email}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Tasks
          </Typography>
          <List>
            {tasks.map((task) => (
              <ListItem key={task.id}>
                <ListItemText
                  primary={task.title}
                  secondary={task.description}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Container>
    </Box>
  );
}

export default App;
