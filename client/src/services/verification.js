import emailjs from "@emailjs/browser";

/**
 * Centralized Verification & Email Service (EmailJS Integration)
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
   * Sends verification code via EmailJS REST API directly from browser
   * @param {string} email 
   * @param {string} code 
   * @returns {Promise<object>}
   */
  sendCode: async (email, code) => {
    try {
      const templateParams = {
        to_email: email,
        code: code,
      };

      const res = await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID,
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );

      console.log("[EmailJS] Verification email sent successfully:", res.status, res.text);
      return { success: true, status: res.status, text: res.text };
    } catch (err) {
      console.error("[EmailJS] Error sending verification email:", err.message || err);
      return { success: false, error: err.message || err };
    }
  }
};
