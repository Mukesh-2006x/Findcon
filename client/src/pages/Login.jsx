import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, TextField, Button, Typography, Snackbar, Alert, Dialog, DialogTitle, DialogContent, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import axios from 'axios';
import { Brand } from '../components/ui';
import { ENDPOINTS } from '../config/api';
import { verificationService } from '../services/verification';

const USER_API = ENDPOINTS.USERS;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  // ── FORGOT PASSWORD STATES & HANDLERS ──
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: Code, 3: Reset
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [enteredForgotCode, setEnteredForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resettingPass, setResettingPass] = useState(false);
  const [userRecord, setUserRecord] = useState(null);

  const handleOpenForgotDialog = () => {
    setForgotStep(1);
    setForgotEmail('');
    setForgotCode('');
    setEnteredForgotCode('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setUserRecord(null);
    setForgotOpen(true);
  };

  const handleSendForgotCode = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) {
      setSnack({ open: true, message: 'Please enter a valid email address', severity: 'error' });
      return;
    }

    setCheckingEmail(true);
    try {
      const res = await axios.get(USER_API);
      const targetUser = res.data.find(u => u.email && u.email.toLowerCase() === forgotEmail.toLowerCase());
      if (!targetUser) {
        setSnack({ open: true, message: 'No user account found with this email', severity: 'error' });
        return;
      }

      setUserRecord(targetUser);
      const code = verificationService.generateCode();
      setForgotCode(code);
      verificationService.sendCode(forgotEmail, code);
      setSnack({ open: true, message: `Verification code: ${code} (simulated & console logged)`, severity: 'info' });
      setForgotStep(2);
    } catch (err) {
      console.log("Forgot password error:", err);
      setSnack({ open: true, message: 'An error occurred. Please try again.', severity: 'error' });
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleVerifyForgotCode = (e) => {
    e.preventDefault();
    if (enteredForgotCode === forgotCode) {
      setSnack({ open: true, message: 'Code verified successfully! Enter new password.', severity: 'success' });
      setForgotStep(3);
    } else {
      setSnack({ open: true, message: 'Invalid verification code', severity: 'error' });
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (forgotNewPassword.length < 6) {
      setSnack({ open: true, message: 'Password must be at least 6 characters', severity: 'error' });
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setSnack({ open: true, message: 'Passwords do not match', severity: 'error' });
      return;
    }
    if (!userRecord) {
      setSnack({ open: true, message: 'User record not found', severity: 'error' });
      return;
    }

    setResettingPass(true);
    try {
      const { id, ...body } = userRecord;
      await axios.put(`${USER_API}/${id}`, { ...body, password: forgotNewPassword });
      setSnack({ open: true, message: 'Password reset successfully! You can now log in.', severity: 'success' });
      setForgotOpen(false);
    } catch (err) {
      console.log("Reset password error:", err);
      setSnack({ open: true, message: 'Failed to reset password', severity: 'error' });
    } finally {
      setResettingPass(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await login(userid, password);
      navigate('/dashboard');
    } catch (err) {
      setSnack({ open: true, message: err.message || 'Login failed', severity: 'error' });
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
        maxWidth: 360,
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

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="User ID"
            value={userid}
            onChange={e => setUserid(e.target.value)}
            required
            size="small"
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
              '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' }
            }}
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            size="small"
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
              '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1 }}>
            <Button
              variant="text"
              onClick={handleOpenForgotDialog}
              sx={{
                color: 'rgba(255,255,255,0.4)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: '12.5px',
                textTransform: 'none',
                p: 0,
                '&:hover': { color: '#ff80ab', background: 'none' }
              }}
            >
              Forgot Password?
            </Button>
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
              '&:hover': {
                background: 'linear-gradient(135deg, #e91e63, #d81b60)',
                boxShadow: '0 6px 20px rgba(255,64,129,0.45)'
              },
              '&:active': { transform: 'scale(0.98)' }
            }}
          >
            Sign In
          </Button>

          <Button
            variant="text"
            onClick={() => navigate('/register')}
            fullWidth
            sx={{
              color: 'rgba(255,255,255,0.5)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
              textTransform: 'none',
              '&:hover': { color: '#ff80ab', background: 'rgba(255,64,129,0.04)' }
            }}
          >
            Don't have an account? Register
          </Button>
        </Box>
      </Box>

      {/* ── FORGOT PASSWORD DIALOG ── */}
      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            background: '#1a1a24',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            color: '#fff',
            p: 1
          }
        }}
      >
        <DialogTitle sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
          <Typography sx={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '18px', color: '#fff' }}>
            Forgot Password
          </Typography>
          <IconButton size="small" onClick={() => setForgotOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 3 }}>
          {forgotStep === 1 && (
            <Box component="form" onSubmit={handleSendForgotCode} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                Enter your email address to search for your account and receive a simulated 6-digit verification code.
              </Typography>
              <TextField
                type="email"
                label="Email Address"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: '#ff4081' },
                    '&.Mui-focused fieldset': { borderColor: '#ff4081' }
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
                <Button onClick={() => setForgotOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>Cancel</Button>
                <Button type="submit" variant="contained" disabled={checkingEmail} sx={{ background: 'linear-gradient(135deg, #ff4081, #f50057)', borderRadius: '8px', fontFamily: "'Syne'", fontWeight: 700, textTransform: 'none', px: 3 }}>
                  {checkingEmail ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Send Code'}
                </Button>
              </Box>
            </Box>
          )}

          {forgotStep === 2 && (
            <Box component="form" onSubmit={handleVerifyForgotCode} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              <Alert severity="info" sx={{ background: 'rgba(33, 150, 243, 0.1)', color: '#90caf9', border: '1px solid rgba(33, 150, 243, 0.2)', borderRadius: '10px' }}>
                [Simulation] Verification code sent to {forgotEmail}.<br />
                Code: <strong>{forgotCode}</strong>
              </Alert>
              <TextField
                label="Verification Code"
                value={enteredForgotCode}
                onChange={e => setEnteredForgotCode(e.target.value)}
                required
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: '#ff4081' },
                    '&.Mui-focused fieldset': { borderColor: '#ff4081' }
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
                <Button onClick={() => setForgotStep(1)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>Back</Button>
                <Button type="submit" variant="contained" sx={{ background: 'linear-gradient(135deg, #ff4081, #f50057)', borderRadius: '8px', fontFamily: "'Syne'", fontWeight: 700, textTransform: 'none', px: 3 }}>
                  Verify Code
                </Button>
              </Box>
            </Box>
          )}

          {forgotStep === 3 && (
            <Box component="form" onSubmit={handleResetPassword} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
              <TextField
                type="password"
                label="New Password"
                value={forgotNewPassword}
                onChange={e => setForgotNewPassword(e.target.value)}
                required
                fullWidth
                helperText="Minimum 6 characters"
                FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: '#ff4081' },
                    '&.Mui-focused fieldset': { borderColor: '#ff4081' }
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' }
                }}
              />
              <TextField
                type="password"
                label="Confirm New Password"
                value={forgotConfirmPassword}
                onChange={e => setForgotConfirmPassword(e.target.value)}
                required
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: '#ff4081' },
                    '&.Mui-focused fieldset': { borderColor: '#ff4081' }
                  },
                  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#ff4081' }
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button type="submit" variant="contained" disabled={resettingPass} sx={{ background: 'linear-gradient(135deg, #ff4081, #f50057)', borderRadius: '8px', fontFamily: "'Syne'", fontWeight: 700, textTransform: 'none', px: 3 }}>
                  {resettingPass ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Reset Password'}
                </Button>
              </Box>
            </Box>
          )}
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
