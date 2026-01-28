// pages/LoginPage.tsx
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
      {/* Background decorations - Data Visualization Theme */}
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
        {/* Grid pattern overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating chart elements - Bar Chart */}
        <Box
          sx={{
            position: 'absolute',
            top: '15%',
            left: '8%',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
            opacity: 0.15,
            transform: 'rotate(-5deg)',
          }}
        >
          {[40, 65, 45, 80, 55, 70].map((h, i) => (
            <Box
              key={i}
              sx={{
                width: 12,
                height: h,
                borderRadius: '4px 4px 0 0',
                background: 'white',
              }}
            />
          ))}
        </Box>

        {/* Floating chart elements - Line Chart */}
        <Box
          sx={{
            position: 'absolute',
            top: '25%',
            right: '10%',
            opacity: 0.12,
            transform: 'rotate(3deg)',
          }}
        >
          <svg width="180" height="80" viewBox="0 0 180 80">
            <polyline
              points="0,60 30,45 60,55 90,25 120,35 150,15 180,30"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {[0, 30, 60, 90, 120, 150, 180].map((x, i) => (
              <circle key={i} cx={x} cy={[60, 45, 55, 25, 35, 15, 30][i]} r="4" fill="white" />
            ))}
          </svg>
        </Box>

        {/* Pie Chart */}
        <Box
          sx={{
            position: 'absolute',
            bottom: '20%',
            left: '12%',
            opacity: 0.1,
            transform: 'rotate(15deg)',
          }}
        >
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="white" strokeWidth="20" strokeDasharray="75 251.2" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="20" strokeDasharray="100 251.2" strokeDashoffset="-75" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="20" strokeDasharray="76.2 251.2" strokeDashoffset="-175" />
          </svg>
        </Box>

        {/* Floating data cards */}
        <Box
          sx={{
            position: 'absolute',
            top: '60%',
            right: '8%',
            width: 120,
            height: 70,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.05)',
            backdropFilter: 'blur(5px)',
            opacity: 0.6,
            transform: 'rotate(8deg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Box sx={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>↑ 24%</Box>
          <Box sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>GROWTH</Box>
        </Box>

        {/* Mini bar chart card */}
        <Box
          sx={{
            position: 'absolute',
            bottom: '30%',
            right: '25%',
            width: 100,
            height: 60,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            opacity: 0.5,
            transform: 'rotate(-6deg)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '4px',
            p: 1,
          }}
        >
          {[20, 35, 25, 45, 30, 40, 35].map((h, i) => (
            <Box
              key={i}
              sx={{
                width: 8,
                height: `${h}%`,
                borderRadius: '2px 2px 0 0',
                background: 'rgba(255,255,255,0.6)',
              }}
            />
          ))}
        </Box>

        {/* Scattered data points */}
        {[
          { top: '10%', left: '30%', size: 6 },
          { top: '20%', left: '45%', size: 4 },
          { top: '35%', left: '15%', size: 5 },
          { top: '45%', right: '30%', size: 4 },
          { top: '70%', left: '35%', size: 6 },
          { top: '80%', right: '40%', size: 5 },
          { top: '15%', right: '35%', size: 4 },
          { bottom: '15%', left: '45%', size: 5 },
        ].map((dot, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              ...dot,
              width: dot.size,
              height: dot.size,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
            }}
          />
        ))}

        {/* Glowing orbs */}
        <Box
          sx={{
            position: 'absolute',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(79, 172, 254, 0.15) 0%, transparent 60%)',
            top: '-200px',
            right: '-200px',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167, 139, 250, 0.12) 0%, transparent 60%)',
            bottom: '-150px',
            left: '-150px',
          }}
        />

        {/* Diagonal accent lines */}
        <Box
          sx={{
            position: 'absolute',
            top: '40%',
            left: '5%',
            width: 80,
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
            transform: 'rotate(-45deg)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: '25%',
            right: '15%',
            width: 60,
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            transform: 'rotate(45deg)',
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
