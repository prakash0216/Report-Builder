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
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as ShowChartIcon,
  TableChart as TableChartIcon,
  Dashboard as DashboardIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  Insights as InsightsIcon,
  DataUsage as DataUsageIcon,
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

  // Floating icon data for background
  const floatingIcons = [
    { Icon: BarChartIcon, top: '8%', left: '5%', size: 48, rotation: -15, opacity: 0.06 },
    { Icon: PieChartIcon, top: '15%', right: '8%', size: 56, rotation: 10, opacity: 0.05 },
    { Icon: ShowChartIcon, top: '35%', left: '3%', size: 44, rotation: 5, opacity: 0.04 },
    { Icon: TableChartIcon, bottom: '30%', right: '5%', size: 52, rotation: -8, opacity: 0.05 },
    { Icon: DashboardIcon, bottom: '15%', left: '8%', size: 50, rotation: 12, opacity: 0.04 },
    { Icon: AnalyticsIcon, top: '55%', right: '3%', size: 46, rotation: -5, opacity: 0.05 },
    { Icon: TrendingUpIcon, top: '75%', left: '4%', size: 42, rotation: 8, opacity: 0.04 },
    { Icon: AssessmentIcon, top: '25%', left: '12%', size: 38, rotation: -12, opacity: 0.03 },
    { Icon: InsightsIcon, bottom: '45%', right: '10%', size: 40, rotation: 15, opacity: 0.04 },
    { Icon: DataUsageIcon, top: '5%', left: '45%', size: 36, rotation: -20, opacity: 0.03 },
    { Icon: BarChartIcon, bottom: '8%', right: '35%', size: 34, rotation: 25, opacity: 0.03 },
    { Icon: PieChartIcon, top: '65%', right: '15%', size: 32, rotation: -10, opacity: 0.03 },
    { Icon: ShowChartIcon, bottom: '55%', left: '15%', size: 30, rotation: 18, opacity: 0.03 },
    { Icon: DashboardIcon, top: '45%', left: '8%', size: 28, rotation: -22, opacity: 0.02 },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #F8FAFC 0%, #F1F5F9 50%, #E2E8F0 100%)',
        position: 'relative',
        overflow: 'hidden',
        p: 3,
      }}
    >
      {/* Background Pattern & Decorations */}
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
        {/* Subtle dot grid pattern */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.15) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Large gradient orbs for depth */}
        <Box
          sx={{
            position: 'absolute',
            width: '900px',
            height: '900px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
            top: '-400px',
            right: '-300px',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, transparent 50%)',
            bottom: '-300px',
            left: '-250px',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 50%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Floating Analytics Icons */}
        {floatingIcons.map((item, index) => {
          const { Icon, size, rotation, opacity, ...position } = item;
          return (
            <Box
              key={index}
              sx={{
                position: 'absolute',
                ...position,
                transform: `rotate(${rotation}deg)`,
                opacity,
                color: '#64748B',
              }}
            >
              <Icon sx={{ fontSize: size }} />
            </Box>
          );
        })}

        {/* Decorative bar chart */}
        <Box
          sx={{
            position: 'absolute',
            top: '12%',
            right: '18%',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
            opacity: 0.08,
            transform: 'rotate(-5deg)',
          }}
        >
          {[35, 55, 40, 70, 50, 65, 45].map((h, i) => (
            <Box
              key={i}
              sx={{
                width: 10,
                height: h,
                borderRadius: '4px 4px 0 0',
                background: 'linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)',
              }}
            />
          ))}
        </Box>

        {/* Decorative line chart */}
        <Box
          sx={{
            position: 'absolute',
            bottom: '18%',
            left: '15%',
            opacity: 0.07,
            transform: 'rotate(3deg)',
          }}
        >
          <svg width="160" height="70" viewBox="0 0 160 70">
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <polyline
              points="0,50 30,40 55,48 80,25 105,35 130,18 160,28"
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {[
              { x: 0, y: 50 },
              { x: 30, y: 40 },
              { x: 55, y: 48 },
              { x: 80, y: 25 },
              { x: 105, y: 35 },
              { x: 130, y: 18 },
              { x: 160, y: 28 },
            ].map((point, i) => (
              <circle key={i} cx={point.x} cy={point.y} r="4" fill="#3B82F6" />
            ))}
          </svg>
        </Box>

        {/* Decorative pie chart */}
        <Box
          sx={{
            position: 'absolute',
            top: '60%',
            right: '8%',
            opacity: 0.06,
            transform: 'rotate(15deg)',
          }}
        >
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="#3B82F6" strokeWidth="16" strokeDasharray="60 200" />
            <circle cx="40" cy="40" r="32" fill="none" stroke="#8B5CF6" strokeWidth="16" strokeDasharray="50 200" strokeDashoffset="-60" />
            <circle cx="40" cy="40" r="32" fill="none" stroke="#10B981" strokeWidth="16" strokeDasharray="40 200" strokeDashoffset="-110" />
            <circle cx="40" cy="40" r="32" fill="none" stroke="#F59E0B" strokeWidth="16" strokeDasharray="50 200" strokeDashoffset="-150" />
          </svg>
        </Box>

        {/* Data card decoration */}
        <Box
          sx={{
            position: 'absolute',
            top: '28%',
            left: '6%',
            width: 100,
            height: 65,
            borderRadius: 2,
            border: '1px solid rgba(148, 163, 184, 0.2)',
            background: 'rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(8px)',
            opacity: 0.6,
            transform: 'rotate(-8deg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 0.5,
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          <Box sx={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>↑ 24%</Box>
          <Box sx={{ fontSize: 9, color: '#64748B', letterSpacing: 1, fontWeight: 500 }}>GROWTH</Box>
        </Box>

        {/* Another data card */}
        <Box
          sx={{
            position: 'absolute',
            bottom: '35%',
            right: '20%',
            width: 90,
            height: 55,
            borderRadius: 2,
            border: '1px solid rgba(148, 163, 184, 0.15)',
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(8px)',
            opacity: 0.5,
            transform: 'rotate(6deg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 0.5,
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          }}
        >
          <Box sx={{ fontSize: 16, fontWeight: 700, color: '#3B82F6' }}>1.2M</Box>
          <Box sx={{ fontSize: 8, color: '#64748B', letterSpacing: 1, fontWeight: 500 }}>RECORDS</Box>
        </Box>

        {/* Horizontal lines decoration */}
        <Box
          sx={{
            position: 'absolute',
            top: '40%',
            left: '2%',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            opacity: 0.08,
          }}
        >
          {[80, 60, 90, 45, 70].map((w, i) => (
            <Box
              key={i}
              sx={{
                width: w,
                height: 3,
                borderRadius: 1,
                background: '#64748B',
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Logo and Title */}
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
          {/* IQVIA Logo - with blue color filter */}
          <Box
            component="img"
            src="IQVIA_Brand_Logo.png"
            alt="IQVIA"
            sx={{
              height: 85,
              mb: 1,
              // Apply IQVIA blue color using CSS filter
              filter: 'brightness(0) saturate(100%) invert(24%) sepia(89%) saturate(1234%) hue-rotate(196deg) brightness(96%) contrast(91%)',
            }}
          />
          
          {/* Report Builder with RBI icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2.5,
                background: 'white',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}
            >
              <img src="RBI.png" alt="Logo" style={{ height: 46, width: 46 }} />
            </Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: '#1E293B',
                letterSpacing: '-0.5px',
              }}
            >
              Report Builder AI
            </Typography>
          </Box>
          
          <Typography
            variant="body1"
            sx={{
              color: '#64748B',
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
            borderRadius: 3,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #E2E8F0',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
            zIndex: 1,
          }}
        >
          {/* Form Header */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: '#1E293B',
                mb: 0.5,
              }}
            >
              Sign In
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              Enter your IQVIA email to continue
            </Typography>
          </Box>

          {/* Error Alert */}
          {error && (
            <Fade in>
              <Alert
                severity="error"
                sx={{ 
                  mb: 2, 
                  borderRadius: 2,
                  border: '1px solid #FEE2E2',
                  bgcolor: '#FEF2F2',
                  '& .MuiAlert-icon': { color: '#EF4444' },
                }}
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
                    <EmailIcon sx={{ color: '#94A3B8', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 3,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: '0.95rem',
                  bgcolor: '#F8FAFC',
                  '& fieldset': { borderColor: '#E2E8F0' },
                  '&:hover fieldset': { borderColor: '#CBD5E1' },
                  '&.Mui-focused fieldset': { borderColor: '#3B82F6', borderWidth: 2 },
                },
                '& .MuiInputLabel-root': { color: '#64748B' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#3B82F6' },
                '& .MuiFormHelperText-root': { 
                  fontSize: '0.75rem',
                  color: '#94A3B8',
                  mt: 1,
                },
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontSize: '0.95rem',
                fontWeight: 600,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  boxShadow: '0 6px 20px rgba(59, 130, 246, 0.45)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Sign In
                <ArrowForwardIcon sx={{ fontSize: 18 }} />
              </Box>
            </Button>
          </Box>

          {/* Divider with text */}
          <Box sx={{ display: 'flex', alignItems: 'center', my: 3 }}>
            <Box sx={{ flex: 1, height: '1px', bgcolor: '#E2E8F0' }} />
            <Typography sx={{ px: 2, color: '#94A3B8', fontSize: '0.75rem', fontWeight: 500 }}>
              Enterprise Security
            </Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: '#E2E8F0' }} />
          </Box>

          {/* Info text */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              color: '#94A3B8',
              lineHeight: 1.6,
            }}
          >
            By signing in, you agree to IQVIA's terms of service and privacy policy
          </Typography>
        </Paper>
      </Fade>

      {/* Footer */}
      <Box sx={{ mt: 4, zIndex: 1, textAlign: 'center' }}>
        <Typography
          variant="caption"
          sx={{
            color: '#94A3B8',
            display: 'block',
          }}
        >
          © {new Date().getFullYear()} IQVIA Report Builder
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: '#CBD5E1',
            fontSize: '0.65rem',
            mt: 0.5,
            display: 'block',
          }}
        >
          Powered by Advanced Analytics
        </Typography>
      </Box>
    </Box>
  );
};

export default LoginPage;
