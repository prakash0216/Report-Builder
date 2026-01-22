import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Paper,
  alpha,
} from '@mui/material';
import {
  SentimentDissatisfied as SadIcon,
  Home as HomeIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

interface NotFoundProps {
  type?: 'dashboard' | 'view' | 'generic';
  message?: string;
}

const NotFound: React.FC<NotFoundProps> = ({ type = 'generic', message }) => {
  const navigate = useNavigate();
  const { dashboardName } = useParams<{ dashboardName?: string }>();

  const getTitle = () => {
    switch (type) {
      case 'dashboard':
        return 'Dashboard Not Found';
      case 'view':
        return 'View Not Found';
      default:
        return 'Page Not Found';
    }
  };

  const getDescription = () => {
    if (message) return message;
    switch (type) {
      case 'dashboard':
        return 'The dashboard you\'re looking for doesn\'t exist or may have been deleted.';
      case 'view':
        return 'The view you\'re looking for doesn\'t exist or may have been deleted.';
      default:
        return 'The page you\'re looking for doesn\'t exist.';
    }
  };

  const getBackButtonText = () => {
    switch (type) {
      case 'view':
        return 'Back to Dashboard';
      default:
        return 'Go to Home';
    }
  };

  const handleBack = () => {
    if (type === 'view' && dashboardName) {
      navigate(`/${dashboardName}`);
    } else {
      navigate('/');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background elements */}
      <Box
        sx={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha('#667eea', 0.08)} 0%, transparent 70%)`,
          top: -150,
          right: -150,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha('#ef4444', 0.06)} 0%, transparent 70%)`,
          bottom: -100,
          left: -100,
          pointerEvents: 'none',
        }}
      />

      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: 4,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${alpha('#667eea', 0.15)}`,
          boxShadow: `0 24px 48px ${alpha('#667eea', 0.1)}`,
          textAlign: 'center',
          maxWidth: 500,
          mx: 2,
        }}
      >
        {/* 404 Icon */}
        <Box
          sx={{
            width: 120,
            height: 120,
            margin: '0 auto 24px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${alpha('#ef4444', 0.1)} 0%, ${alpha('#f59e0b', 0.1)} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${alpha('#ef4444', 0.2)}`,
          }}
        >
          <SadIcon sx={{ fontSize: 64, color: '#ef4444' }} />
        </Box>

        {/* Error Code */}
        <Typography
          variant="h1"
          sx={{
            fontSize: '5rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            mb: 2,
          }}
        >
          404
        </Typography>

        {/* Title */}
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ color: '#1e293b', mb: 1.5 }}
        >
          {getTitle()}
        </Typography>

        {/* Description */}
        <Typography
          variant="body1"
          sx={{
            color: 'text.secondary',
            mb: 4,
            lineHeight: 1.7,
            maxWidth: 400,
            mx: 'auto',
          }}
        >
          {getDescription()}
        </Typography>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={type === 'view' ? <ArrowBackIcon /> : <HomeIcon />}
            onClick={handleBack}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              py: 1.5,
              borderRadius: 2.5,
              boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            {getBackButtonText()}
          </Button>

          {type === 'view' && (
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={() => navigate('/')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1.5,
                borderRadius: 2.5,
                borderColor: alpha('#667eea', 0.3),
                color: '#667eea',
                '&:hover': {
                  borderColor: '#667eea',
                  bgcolor: alpha('#667eea', 0.05),
                },
              }}
            >
              Go to Home
            </Button>
          )}
        </Box>

        {/* Help text */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 4,
            color: 'text.disabled',
          }}
        >
          If you believe this is an error, please contact your administrator.
        </Typography>
      </Paper>
    </Box>
  );
};

export default NotFound;

