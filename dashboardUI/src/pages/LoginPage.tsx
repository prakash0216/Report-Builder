// pages/LoginPage.tsx
// Simple login page with email only for flow purposes
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  InputAdornment,
  Fade,
} from '@mui/material';
import {
  Email as EmailIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { authState, authAPI } from '../recoil/AuthState';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [auth, setAuth] = useRecoilState(authState);
  
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (auth.isAuthenticated && auth.email) {
      navigate('/');
    }
  }, [auth.isAuthenticated, auth.email, navigate]);

  const validateEmail = (email: string): boolean => {
    const iqviaRegex = /^[a-zA-Z0-9._%+-]+@iqvia\.com$/i;
    return iqviaRegex.test(email);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please use your @iqvia.com email address');
      return;
    }

    // Save email and login
    authAPI.login(email);
    setAuth({
      isAuthenticated: true,
      email: email,
    });
    
    navigate('/');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        position: 'relative',
        overflow: 'hidden',
        p: 3,
      }}
    >
      {/* Background decorations */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
            top: '-150px',
            right: '-150px',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, transparent 70%)',
            bottom: '-100px',
            left: '-100px',
          }}
        />
      </Box>

      {/* IQVIA Logo and Title */}
      <Fade in timeout={600}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            mb: 4,
            zIndex: 1,
          }}
        >
          {/* IQVIA Logo */}
          <Box
            component="img"
            src="IQVIA_Brand_Logo.png"
            alt="IQVIA"
            sx={{
              height: 110,
              filter: 'brightness(0) invert(1)',
            }}
          />
          
          {/* Report Builder with RBI icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width:  56,
                height: 56,
                borderRadius: 3,
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              <img src="RBI.png" alt="Logo" style={{ height: 60, width: 60 }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: 'white',
                letterSpacing: '-0.5px',
              }}
            >
              Report Builder AI
            </Typography>
          </Box>
          
          <Typography
            variant="body1"
            sx={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: 400,
              textAlign: 'center',
            }}
          >
            Design, Build and Visualize powerful analytics dashboards
          </Typography>
        </Box>
      </Fade>

      {/* Login Form */}
      <Fade in timeout={800}>
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: 4,
            borderRadius: 4,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.25)',
            zIndex: 1,
          }}
        >
          {/* Form Header */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#1a1a2e',
                mb: 0.5,
              }}
            >
              Sign In
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Enter your IQVIA email to continue
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Fade in>
              <Alert
                severity="error"
                sx={{ mb: 2, borderRadius: 2 }}
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            </Fade>
          )}

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="your.name@iqvia.com"
              helperText="Only @iqvia.com emails allowed"
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: '#667eea', fontSize: 22 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: '1rem',
                  '&:hover fieldset': { borderColor: '#667eea' },
                  '&.Mui-focused fieldset': { borderColor: '#667eea' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: '#667eea' },
                '& .MuiFormHelperText-root': { fontSize: '0.75rem' },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontSize: '1rem',
                fontWeight: 600,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%)',
                  boxShadow: '0 6px 24px rgba(102, 126, 234, 0.5)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Sign In
                <ArrowForwardIcon sx={{ fontSize: 20 }} />
              </Box>
            </Button>
          </Box>
        </Paper>
      </Fade>

      {/* Footer */}
      <Typography
        variant="caption"
        sx={{
          mt: 4,
          color: 'rgba(255, 255, 255, 0.7)',
          zIndex: 1,
        }}
      >
        © {new Date().getFullYear()} IQVIA Report Builder
      </Typography>
    </Box>
  );
};

export default LoginPage;
