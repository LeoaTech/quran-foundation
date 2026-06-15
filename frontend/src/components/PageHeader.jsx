import Button from "./Button";
import { useState, useEffect } from "react";

/**
 * @param {string} title
 * @param {string} [subtitle]
 * @param {{ label: string, onClick: () => void, variant?: string }} [action]
 */
export default function PageHeader({ title, subtitle, action }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        marginBottom: isMobile ? 18 : 24,
        display: "flex",
        alignItems: isMobile ? "stretch" : "flex-start",
        justifyContent: "space-between",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 12 : 16
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: isMobile ? 18 : 26,
            color: "var(--ink)",
            lineHeight: 1.2,
            marginBottom: subtitle ? (isMobile ? 2 : 3) : 0
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: isMobile ? 12 : 13, color: "var(--ink-soft)" }}>
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <Button
          variant={action.variant ?? "primary"}
          size={isMobile ? "sm" : "md"}
          onClick={action.onClick}
          style={{ width: isMobile ? "100%" : "auto" }}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
