function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "NH";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Avatar({
  src = "",
  name = "",
  className = "h-12 w-12",
  imageClassName = "",
  textClassName = "text-sm",
}) {
  if (src) {
    return (
      <img
        alt={name ? `${name} profile` : "Profile"}
        className={[
          "rounded-full border border-black/5 bg-white object-cover shadow-[0_8px_24px_rgba(22,33,38,0.08)]",
          className,
          imageClassName,
        ].join(" ")}
        src={src}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={[
        "inline-flex items-center justify-center rounded-full bg-gradient-to-br from-teal-700 to-rust-500 font-black text-white shadow-[0_8px_24px_rgba(22,33,38,0.08)]",
        className,
        textClassName,
      ].join(" ")}
    >
      {getInitials(name)}
    </span>
  );
}

export default Avatar;
