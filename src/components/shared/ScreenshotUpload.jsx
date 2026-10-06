import { useEffect } from "react";
import { V } from "../../constants.js";
function ScreenshotUpload({label,value,onChange,s}) {
  useEffect(() => {
    const blobUrl = value?.preview;
    if (!blobUrl) return;
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [value]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Max 2MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    const preview = URL.createObjectURL(file);

    onChange({
      file,
      preview,
    });
  };

  const imageUrl =
    typeof value === "string"
      ? value
      : value?.preview || "";

  return (
    <div style={{marginTop:10}}>
      <label style={s.ilbl}>{label}</label>

      {imageUrl ? (
        <div style={{position:"relative",marginTop:4}}>
          <img
            src={imageUrl}
            alt={label}
            onClick={() => window.open(imageUrl)}
            style={{
              width:"100%",
              borderRadius:V.radius,
              border:`0.5px solid ${V.border}`,
              maxHeight:160,
              objectFit:"cover",
              cursor:"pointer"
            }}
          />

          <button
            onClick={() => onChange("")}
            style={{
              position:"absolute",
              top:6,
              right:6,
              background:"rgba(0,0,0,0.6)",
              border:"none",
              borderRadius:4,
              cursor:"pointer",
              color:"#fff",
              fontSize:11,
              padding:"3px 8px"
            }}
          >
            ✕ Remove
          </button>
        </div>
      ) : (
        <label
          style={{
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            gap:8,
            padding:"16px",
            border:`1px dashed ${V.border}`,
            borderRadius:V.radius,
            cursor:"pointer",
            color:V.muted,
            fontSize:12,
            marginTop:4
          }}
        >
          <span style={{fontSize:18}}>📷</span>
          Click to upload (max 2MB)

          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{display:"none"}}
          />
        </label>
      )}
    </div>
  );
}


export default ScreenshotUpload;
