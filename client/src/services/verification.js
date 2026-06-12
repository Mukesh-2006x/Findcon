import axios from "axios";
import { API_BASE } from "../config/api";

/**
 * Centralized Verification & Email Service
 */
export const verificationService = {
  /**
   * Generates a 6-digit random code
   * @returns {string}
   */
  generateCode: () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Sends verification code via server API (using Resend or console fallback)
   * @param {string} email 
   * @param {string} code 
   * @returns {Promise<boolean>}
   */
  sendCode: async (email, code) => {
    try {
      const res = await axios.post(`${API_BASE}/send-verification`, { email, code });
      return { success: true, ...res.data };
    } catch (err) {
      const serverError = err.response?.data?.message || err.response?.data?.error || err.message;
      console.error("[Verification Service] Error sending verification email:", serverError);
      return { success: false, error: serverError };
    }
  }
};
