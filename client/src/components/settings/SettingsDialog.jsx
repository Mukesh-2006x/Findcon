import React, { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, Typography, IconButton, Stack, Button, Box, TextField, Alert, CircularProgress
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LockIcon from "@mui/icons-material/Lock";
import HelpIcon from "@mui/icons-material/Help";
import LogoutIcon from "@mui/icons-material/Logout";
import { verificationService } from "../../services/verification";

/**
 * Reusable Settings and Security Dialog
 */
export default function SettingsDialog({
  open,
  onClose,
  currentUser,
  updatePassword,
  logout,
  showSnack,
  navigate
}) {
  const [settingsView, setSettingsView] = useState("menu"); // "menu" | "change_password" | "forgot_password_email" | "forgot_password_code" | "forgot_password_reset"

  // Password change states
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Forgot password reset states
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [enteredForgotCode, setEnteredForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [sendingForgotCode, setSendingForgotCode] = useState(false);

  const resetAllStates = () => {
    setSettingsView("menu");
    setOldPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setForgotEmail("");
    setForgotCode("");
    setEnteredForgotCode("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
  };

  const handleClose = () => {
    resetAllStates();
    onClose();
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showSnack("Password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showSnack("New passwords do not match", "error");
      return;
    }
    if (oldPassword !== currentUser.password) {
      showSnack("Old password is incorrect", "error");
      return;
    }

    setChangingPass(true);
    try {
      await updatePassword(currentUser.userid, newPassword);
      showSnack("Password updated successfully!", "success");
      handleClose();
    } catch (err) {
      showSnack(err.message || "Failed to update password", "error");
    } finally {
      setChangingPass(false);
    }
  };

  const handleSendForgotCode = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes("@")) {
      showSnack("Please enter a valid email", "error");
      return;
    }
    if (forgotEmail.toLowerCase() !== currentUser.email.toLowerCase()) {
      showSnack("Email does not match this account's email", "error");
      return;
    }

    setSendingForgotCode(true);
    try {
      const code = verificationService.generateCode();
      setForgotCode(code);
      const res = await verificationService.sendCode(forgotEmail, code);
      if (res.success) {
        if (res.simulated) {
          showSnack(`[Simulation] Verification code generated: ${code}`, "info");
          setEnteredForgotCode(code); // pre-fill for developer convenience
        } else {
          showSnack(`Verification code sent to ${forgotEmail}! Check your inbox.`, "success");
        }
        setSettingsView("forgot_password_code");
      } else {
        showSnack("Failed to send code. Make sure server is running.", "error");
      }
    } catch (err) {
      showSnack("Failed to send code", "error");
    } finally {
      setSendingForgotCode(false);
    }
  };

  const handleVerifyForgotCode = (e) => {
    e.preventDefault();
    if (enteredForgotCode === forgotCode) {
      showSnack("Code verified! Set your new password.", "success");
      setSettingsView("forgot_password_reset");
    } else {
      showSnack("Invalid verification code", "error");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (forgotNewPassword.length < 6) {
      showSnack("Password must be at least 6 characters", "error");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      showSnack("Passwords do not match", "error");
      return;
    }

    try {
      await updatePassword(currentUser.userid, forgotNewPassword);
      showSnack("Password reset successfully!", "success");
      handleClose();
    } catch (err) {
      showSnack(err.message || "Failed to reset password", "error");
    }
  };

  const handleSettingsLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" className="dialog-dark">
      <DialogTitle sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5 }}>
        <Typography sx={{ fontFamily: "'Syne'", fontWeight: 800, fontSize: 18, color: "#fff" }}>
          {settingsView === "menu" && "Settings"}
          {settingsView === "change_password" && "Change Password"}
          {settingsView.startsWith("forgot_password") && "Forgot Password"}
        </Typography>
        <IconButton size="small" onClick={handleClose} sx={{ color: "rgba(255,255,255,0.5)" }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 3 }}>
        {settingsView === "menu" && (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            <Button
              fullWidth
              onClick={() => setSettingsView("change_password")}
              startIcon={<LockIcon sx={{ color: "#ff4081" }} />}
              sx={{
                justifyContent: "flex-start", py: 1.5, px: 2, color: "#fff", fontFamily: "'DM Sans'", fontSize: 14,
                textTransform: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", borderRadius: 0,
                "&:hover": { background: "rgba(255,64,129,0.06)", color: "#ff80ab" }
              }}
            >
              Change Password
            </Button>
            <Button
              fullWidth
              onClick={() => {
                setForgotEmail(currentUser?.email || "");
                setSettingsView("forgot_password_email");
              }}
              startIcon={<HelpIcon sx={{ color: "#ff4081" }} />}
              sx={{
                justifyContent: "flex-start", py: 1.5, px: 2, color: "#fff", fontFamily: "'DM Sans'", fontSize: 14,
                textTransform: "none", borderBottom: "1px solid rgba(255,255,255,0.05)", borderRadius: 0,
                "&:hover": { background: "rgba(255,64,129,0.06)", color: "#ff80ab" }
              }}
            >
              Forgot Password?
            </Button>
            <Button
              fullWidth
              onClick={handleSettingsLogout}
              startIcon={<LogoutIcon sx={{ color: "#ff5252" }} />}
              sx={{
                justifyContent: "flex-start", py: 1.5, px: 2, color: "#ff5252", fontFamily: "'DM Sans'", fontSize: 14,
                textTransform: "none", borderRadius: 2, mt: 1,
                "&:hover": { background: "rgba(255,82,82,0.08)", color: "#ff5252" }
              }}
            >
              Logout
            </Button>
          </Stack>
        )}

        {settingsView === "change_password" && (
          <Box component="form" onSubmit={handleChangePassword} sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              type="password"
              label="Old Password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              required
              fullWidth
            />
            <TextField
              type="password"
              label="New Password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              fullWidth
              helperText="Minimum 6 characters"
              FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.4)" } }}
            />
            <TextField
              type="password"
              label="Confirm New Password"
              value={confirmNewPassword}
              onChange={e => setConfirmNewPassword(e.target.value)}
              required
              fullWidth
            />
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1, gap: 1.5 }}>
              <Button
                onClick={() => {
                  setForgotEmail(currentUser?.email || "");
                  setSettingsView("forgot_password_email");
                }}
                sx={{ color: "#ff80ab", textTransform: "none", fontSize: 12.5, fontFamily: "'DM Sans'", p: 0 }}
              >
                Forgot Password?
              </Button>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 1 }}>
              <Button onClick={() => setSettingsView("menu")} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }}>Back</Button>
              <Button type="submit" variant="contained" disabled={changingPass} sx={{ background: "linear-gradient(135deg, #ff4081, #f50057)", borderRadius: 2, fontFamily: "'Syne'", fontWeight: 700, textTransform: "none" }}>
                {changingPass ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save Password"}
              </Button>
            </Box>
          </Box>
        )}

        {settingsView === "forgot_password_email" && (
          <Box component="form" onSubmit={handleSendForgotCode} sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Typography sx={{ fontFamily: "'DM Sans'", fontSize: 13, color: "rgba(255,255,255,0.6)", mb: 0.5 }}>
              Enter your email address to receive a 6-digit verification code.
            </Typography>
            <TextField
              type="email"
              label="Email Address"
              value={forgotEmail}
              onChange={e => setForgotEmail(e.target.value)}
              required
              fullWidth
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 1 }}>
              <Button onClick={() => setSettingsView("menu")} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={sendingForgotCode} sx={{ background: "linear-gradient(135deg, #ff4081, #f50057)", borderRadius: 2, fontFamily: "'Syne'", fontWeight: 700, textTransform: "none" }}>
                {sendingForgotCode ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Send Code"}
              </Button>
            </Box>
          </Box>
        )}

        {settingsView === "forgot_password_code" && (
          <Box component="form" onSubmit={handleVerifyForgotCode} sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <Alert severity="info" sx={{ background: "rgba(33, 150, 243, 0.1)", color: "#90caf9", border: "1px solid rgba(33, 150, 243, 0.2)", borderRadius: 2 }}>
              [Simulation] Verification code sent to {forgotEmail}.<br />
              Code: <strong>{forgotCode}</strong>
            </Alert>
            <TextField
              label="Verification Code"
              value={enteredForgotCode}
              onChange={e => setEnteredForgotCode(e.target.value)}
              required
              fullWidth
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 1 }}>
              <Button onClick={() => setSettingsView("forgot_password_email")} sx={{ color: "rgba(255,255,255,0.5)", textTransform: "none" }}>Back</Button>
              <Button type="submit" variant="contained" sx={{ background: "linear-gradient(135deg, #ff4081, #f50057)", borderRadius: 2, fontFamily: "'Syne'", fontWeight: 700, textTransform: "none" }}>
                Verify Code
              </Button>
            </Box>
          </Box>
        )}

        {settingsView === "forgot_password_reset" && (
          <Box component="form" onSubmit={handleResetPassword} sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
            <TextField
              type="password"
              label="New Password"
              value={forgotNewPassword}
              onChange={e => setForgotNewPassword(e.target.value)}
              required
              fullWidth
              helperText="Minimum 6 characters"
              FormHelperTextProps={{ sx: { color: "rgba(255,255,255,0.4)" } }}
            />
            <TextField
              type="password"
              label="Confirm New Password"
              value={forgotConfirmPassword}
              onChange={e => setForgotConfirmPassword(e.target.value)}
              required
              fullWidth
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5, mt: 1 }}>
              <Button type="submit" variant="contained" sx={{ background: "linear-gradient(135deg, #ff4081, #f50057)", borderRadius: 2, fontFamily: "'Syne'", fontWeight: 700, textTransform: "none" }}>
                Reset Password
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
