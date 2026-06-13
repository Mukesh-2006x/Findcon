import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Box, TextField, Button, Typography, Snackbar, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { Brand } from '../components/ui';
import { ENDPOINTS, IMGBB_API_KEY } from '../config/api';
import { verificationService } from '../services/verification';

const USER_API = ENDPOINTS.USERS;

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [userid, setUserid] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationInput, setVerificationInput] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // Validation states
  const [useridAvailable, setUseridAvailable] = useState(null); // null = unchecked, true = available, false = taken
  const [emailVerified, setEmailVerified] = useState(false);
  const [checkingUserid, setCheckingUserid] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);

  // Check if userid exists in API
  const checkUseridAvailability = async (uid) => {
    if (!uid || uid.length < 3) {
      setUseridAvailable(null);
      return;
    }
    setCheckingUserid(true);
    try {
      const res = await axios.get(USER_API);
      const exists = res.data.some(u => u.userid === uid);
      setUseridAvailable(!exists);
      if (exists) {
        setSnack({ open: true, message: 'User ID already taken', severity: 'error' });
      }
    } catch (err) {
      console.log("Error checking userid:", err);
    } finally {
      setCheckingUserid(false);
    }
  };

  const handleUseridChange = (e) => {
    const uid = e.target.value.toLowerCase();
    setUserid(uid);
    // Debounce check
    const timer = setTimeout(() => checkUseridAvailability(uid), 500);
    return () => clearTimeout(timer);
  };

  // Handle profile picture upload to ImgBB
  const handleProfilePicChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSnack({ open: true, message: 'Please select an image file', severity: 'error' });
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicPreview(reader.result);
    };
    reader.readAsDataURL(file);

    setProfilePic(file);
    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('key', IMGBB_API_KEY);

      const response = await axios.post('https://api.imgbb.com/1/upload', formData);
      setProfilePicUrl(response.data.data.url);
      setSnack({ open: true, message: 'Profile picture uploaded successfully', severity: 'success' });
    } catch (err) {
      console.log("Error uploading to ImgBB:", err);
      setSnack({ open: true, message: 'Failed to upload image. Continuing without profile pic.', severity: 'warning' });
      setProfilePicUrl('');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Send verification code to email
  const sendVerificationCode = async () => {
    if (!email || !email.includes('@')) {
      setSnack({ open: true, message: 'Please enter a valid email', severity: 'error' });
      return;
    }

    setSendingCode(true);
    try {
      const code = verificationService.generateCode();
      setVerificationCode(code);
      const res = await verificationService.sendCode(email, code);

      if (res.success) {
        if (res.simulated) {
          setSnack({ 
            open: true, 
            message: `[Simulation] Code generated: ${code} (pre-filled for ease)`, 
            severity: 'info' 
          });
          setVerificationInput(code);
        } else {
          setSnack({ 
            open: true, 
            message: `Verification code sent to ${email}. Check your email inbox.`, 
            severity: 'success' 
          });
        }
        setVerifyDialogOpen(true);
      } else {
        setSnack({ 
          open: true, 
          message: `Failed to send verification code. Make sure server is running.`, 
          severity: 'error' 
        });
      }
    } catch (err) {
      console.log("Error sending verification code:", err);
      setSnack({ open: true, message: 'Failed to send verification code', severity: 'error' });
    } finally {
      setSendingCode(false);
    }
  };

  // Verify email code
  const verifyEmail = () => {
    if (!verificationInput) {
      setSnack({ open: true, message: 'Please enter the verification code', severity: 'error' });
      return;
    }

    if (verificationInput === verificationCode) {
      setEmailVerified(true);
      setVerifyDialogOpen(false);
      setSnack({ open: true, message: 'Email verified successfully', severity: 'success' });
    } else {
      setSnack({ open: true, message: 'Invalid verification code', severity: 'error' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!userid || userid.length < 3) {
      setSnack({ open: true, message: 'User ID must be at least 3 characters', severity: 'error' });
      return;
    }

    if (useridAvailable === false) {
      setSnack({ open: true, message: 'User ID is already taken', severity: 'error' });
      return;
    }

    if (password.length < 6) {
      setSnack({ open: true, message: 'Password must be at least 6 characters', severity: 'error' });
      return;
    }

    if (password !== confirm) {
      setSnack({ open: true, message: 'Passwords do not match', severity: 'error' });
      return;
    }

    if (!emailVerified) {
      setSnack({ open: true, message: 'Please verify your email first', severity: 'error' });
      return;
    }

    try {
      await register({ userid, password, email, profilepic: profilePicUrl || '' });
      setSnack({ open: true, message: 'Registration successful! Redirecting...', severity: 'success' });
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setSnack({ open: true, message: err.message || 'Registration failed', severity: 'error' });
    }
  };

  return (
    <Box sx={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      px: 2,
      py: 2
    }}>
      <Box sx={{
        width: '100%',
        maxWidth: 380,
        p: 3,
        background: 'linear-gradient(160deg, #1c1c28 0%, #141420 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '24px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #ff4081, #ff80ab)'
        }
      }}>
        <Brand variant="large" />

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
          {/* Profile Picture Upload */}
          <Box sx={{
            textAlign: 'center',
            pb: 1.5,
            borderBottom: '1px solid rgba(255,255,255,0.08)'
          }}>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="profile-pic-input"
              type="file"
              onChange={handleProfilePicChange}
            />
            <label htmlFor="profile-pic-input">
              <Box sx={{
                position: 'relative',
                width: 70,
                height: 70,
                margin: '0 auto',
                borderRadius: '50%',
                background: profilePicPreview ? `url(${profilePicPreview})` : 'rgba(255,64,129,0.1)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '2px dashed rgba(255,64,129,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: '#ff4081',
                  background: profilePicPreview ? `url(${profilePicPreview})` : 'rgba(255,64,129,0.15)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }
              }}>
                {uploadingPhoto && <CircularProgress size={24} sx={{ color: '#ff4081' }} />}
                {!uploadingPhoto && !profilePicPreview && (
                  <PhotoCameraIcon sx={{ fontSize: 28, color: 'rgba(255,255,255,0.3)' }} />
                )}
              </Box>
            </label>
            <Typography sx={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              mt: 0.8,
              textAlign: 'center'
            }}>
              {profilePicUrl ? 'Picture uploaded ✓' : 'Upload profile picture (optional)'}
            </Typography>
          </Box>

          {/* User ID with availability check */}
          <Box>
            <TextField
              label="User ID"
              value={userid}
              onChange={handleUseridChange}
              required
              fullWidth
              size="small"
              helperText={
                userid.length > 0 && userid.length < 3
                  ? 'Minimum 3 characters'
                  : useridAvailable === true
                  ? '✓ Available'
                  : useridAvailable === false
                  ? '✗ Already taken'
                  : ''
              }
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px',
                  '& fieldset': {
                    borderColor:
                      useridAvailable === true
                        ? 'rgba(76, 175, 80, 0.5)'
                        : useridAvailable === false
                        ? 'rgba(244, 67, 54, 0.5)'
                        : 'rgba(255,255,255,0.1)'
                  },
                  '&:hover fieldset': { borderColor: '#ff4081' },
                  '&.Mui-focused fieldset': { borderColor: '#ff4081' }
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: '13px' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' },
                '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.4)', fontSize: '10px', mt: 0.3 }
              }}
              InputProps={{
                endAdornment: (
                  <>
                    {checkingUserid && <CircularProgress size={16} sx={{ color: '#ff4081' }} />}
                    {!checkingUserid && useridAvailable === true && (
                      <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 18 }} />
                    )}
                    {!checkingUserid && useridAvailable === false && (
                      <ErrorIcon sx={{ color: '#f44336', fontSize: 18 }} />
                    )}
                  </>
                )
              }}
            />
          </Box>

          {/* Email with verification */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              fullWidth
              disabled={emailVerified}
              size="small"
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  background: emailVerified ? 'rgba(76, 175, 80, 0.08)' : 'rgba(255,255,255,0.04)',
                  borderRadius: '12px',
                  '& fieldset': { borderColor: emailVerified ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: emailVerified ? 'rgba(76, 175, 80, 0.3)' : '#ff4081' },
                  '&.Mui-focused fieldset': { borderColor: '#ff4081' }
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: '13px' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' }
              }}
              InputProps={{
                endAdornment: emailVerified && <CheckCircleIcon sx={{ color: '#4caf50', fontSize: 18 }} />
              }}
            />
            {!emailVerified && (
              <Button
                variant="contained"
                onClick={sendVerificationCode}
                disabled={sendingCode}
                sx={{
                  background: 'linear-gradient(135deg, #ff4081, #f50057)',
                  borderRadius: '12px',
                  px: 2.5,
                  py: 1,
                  fontSize: '12.5px',
                  fontWeight: 700,
                  fontFamily: "'Syne', sans-serif",
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  height: 40,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #e91e63, #d81b60)'
                  }
                }}
              >
                {sendingCode ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Verify'}
              </Button>
            )}
          </Box>

          {/* Password side by side */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              fullWidth
              size="small"
              helperText={password.length > 0 && password.length < 6 ? 'Min 6 chars' : ''}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#ff4081' },
                  '&.Mui-focused fieldset': { borderColor: '#ff4081' }
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: '13px' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' },
                '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.4)', fontSize: '10px' }
              }}
            />
            <TextField
              label="Confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              fullWidth
              size="small"
              helperText={confirm.length > 0 && password !== confirm ? 'No match' : ''}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: '#ff4081' },
                  '&.Mui-focused fieldset': { borderColor: '#ff4081' }
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: '13px' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' },
                '& .MuiFormHelperText-root': { color: 'rgba(255,255,255,0.4)', fontSize: '10px' }
              }}
            />
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{
              background: 'linear-gradient(135deg, #ff4081, #f50057)',
              borderRadius: '12px',
              py: 1.2,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 700,
              fontSize: '14.5px',
              textTransform: 'none',
              boxShadow: '0 4px 15px rgba(255,64,129,0.3)',
              transition: 'transform 0.15s, box-shadow 0.2s',
              mt: 0.5,
              '&:hover': {
                background: 'linear-gradient(135deg, #e91e63, #d81b60)',
                boxShadow: '0 6px 20px rgba(255,64,129,0.45)'
              },
              '&:active': { transform: 'scale(0.98)' }
            }}
          >
            Register
          </Button>

          <Button
            variant="text"
            onClick={() => navigate('/login')}
            fullWidth
            sx={{
              color: 'rgba(255,255,255,0.5)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              textTransform: 'none',
              '&:hover': { color: '#ff80ab', background: 'rgba(255,64,129,0.04)' }
            }}
          >
            Already have an account? Sign In
          </Button>
        </Box>
      </Box>

      {/* ── EMAIL VERIFICATION DIALOG ── */}
      <Dialog
        open={verifyDialogOpen}
        onClose={() => setVerifyDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            background: '#1c1c28',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            color: '#fff',
            p: 1.5
          }
        }}
      >
        <DialogTitle sx={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          Verify Your Email
          <IconButton onClick={() => setVerifyDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            We've sent a 6-digit verification code to <strong>{email}</strong>. Please enter the code below to verify your email.
          </Typography>
          <TextField
            fullWidth
            placeholder="Enter 6-digit code"
            value={verificationInput}
            onChange={e => setVerificationInput(e.target.value)}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '10px',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                '&:hover fieldset': { borderColor: '#ff4081' },
                '&.Mui-focused fieldset': { borderColor: '#ff4081' }
              }
            }}
          />
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={sendVerificationCode}
              disabled={sendingCode}
              sx={{
                borderColor: '#ff4081',
                color: '#ff4081',
                borderRadius: '10px',
                textTransform: 'none',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '13px',
                '&:hover': { borderColor: '#ff80ab', background: 'rgba(255,64,129,0.04)' }
              }}
            >
              {sendingCode ? 'Resending...' : 'Resend Code'}
            </Button>
            <Button
              variant="contained"
              fullWidth
              onClick={verifyEmail}
              sx={{
                background: 'linear-gradient(135deg, #ff4081, #f50057)',
                borderRadius: '10px',
                textTransform: 'none',
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: '0 4px 10px rgba(255,64,129,0.2)',
                '&:hover': { background: 'linear-gradient(135deg, #e91e63, #d81b60)' }
              }}
            >
              Verify Code
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.severity} sx={{ width: '100%', borderRadius: '10px' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
