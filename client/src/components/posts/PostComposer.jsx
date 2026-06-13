import React, { useState, useRef } from "react";
import axios from "axios";
import {
  Box, Avatar, TextField, Button, CircularProgress, IconButton, Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import { ENDPOINTS } from "../../config/api";

const POST_API = ENDPOINTS.POSTS;

export default function PostComposer({ currentUser, onPostCreated }) {
  const [composerCaption, setComposerCaption] = useState("");
  const [composerTags, setComposerTags] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingPost, setUploadingPost] = useState(false);
  const fileInputRef = useRef(null);

  const handleSelectImage = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreatePost = async () => {
    if (!imageFile) return;
    if (!composerCaption.trim()) return;

    setUploadingPost(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const IMGBB_KEY = import.meta.env.VITE_IMGBB_API_KEY;
      const uploadRes = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, formData);
      const url = uploadRes.data?.data?.url;

      if (!url) throw new Error("No URL returned from upload");

      // Format tags
      const formattedTags = composerTags
        .split(",")
        .map(t => t.trim().replace(/^#/, ""))
        .filter(Boolean);

      const titleWithTags = composerCaption.trim() + (formattedTags.length ? " || tags:" + formattedTags.join(",") : "");

      // Send to Retool API
      const newPostObj = {
        post: url,
        userid: currentUser.userid,
        likes: "",
        title: titleWithTags,
        comment: ""
      };

      await axios.post(POST_API, newPostObj);

      // Reset Form
      setComposerCaption("");
      setComposerTags("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Trigger callback to refresh page data
      if (onPostCreated) {
        onPostCreated();
      }
    } catch (err) {
      console.log("Error creating post:", err);
    } finally {
      setUploadingPost(false);
    }
  };

  return (
    <div className="feed-composer">
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", mb: 2 }}>
        <Avatar src={currentUser?.profilepic} sx={{ width: 40, height: 40, border: "2px solid #ff4081" }}>
          {currentUser?.userid?.[0]?.toUpperCase()}
        </Avatar>
        <TextField
          fullWidth
          multiline
          rows={2}
          placeholder={`Share something, @${currentUser?.userid}...`}
          value={composerCaption}
          onChange={e => setComposerCaption(e.target.value)}
          sx={{
            "& .MuiOutlinedInput-root": {
              color: "#fff",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "12px",
              "& fieldset": { borderColor: "transparent" },
              "&.Mui-focused fieldset": { borderColor: "rgba(255,64,129,0.3)" }
            },
            "& textarea::placeholder": { color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans'" }
          }}
        />
      </Box>

      {imagePreview && (
        <Box sx={{ position: "relative", borderRadius: "12px", overflow: "hidden", mb: 2, maxHeight: 250, border: "1px solid rgba(255,255,255,0.1)" }}>
          <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "auto", display: "block" }} />
          <IconButton
            onClick={() => { setImageFile(null); setImagePreview(null); }}
            sx={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", color: "#fff", "&:hover": { background: "rgba(0,0,0,0.8)" } }}
            size="small"
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
        <Box sx={{ display: "flex", gap: 1, flex: 1 }}>
          <Button
            variant="outlined"
            component="label"
            startIcon={<AddPhotoAlternateIcon />}
            sx={{
              borderColor: "rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)",
              borderRadius: "10px",
              textTransform: "none",
              fontFamily: "'DM Sans'",
              fontSize: 12.5,
              py: 0.8,
              "&:hover": { borderColor: "#ff4081", background: "rgba(255,64,129,0.04)" }
            }}
          >
            Photo
            <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleSelectImage} />
          </Button>
          <TextField
            size="small"
            placeholder="Tags (tag1, tag2)..."
            value={composerTags}
            onChange={e => setComposerTags(e.target.value)}
            sx={{
              flex: 1,
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                background: "rgba(255,255,255,0.04)",
                borderRadius: "10px",
                height: "36px",
                fontSize: "12px",
                "& fieldset": { borderColor: "transparent" }
              },
              "& input::placeholder": { color: "rgba(255,255,255,0.3)" }
            }}
          />
        </Box>

        <Button
          variant="contained"
          onClick={handleCreatePost}
          disabled={!imageFile || !composerCaption.trim() || uploadingPost}
          sx={{
            background: "linear-gradient(135deg, #ff4081, #f50057)",
            borderRadius: "10px",
            textTransform: "none",
            fontFamily: "'Syne'",
            fontWeight: 700,
            fontSize: 13,
            px: 3,
            height: "36px",
            "&:disabled": { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }
          }}
        >
          {uploadingPost ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Post"}
        </Button>
      </Box>
    </div>
  );
}
