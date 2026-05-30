import { useRouteError } from "react-router-dom";

export default function ChatError() {
  const err = useRouteError();
  return (
    <pre
      style={{
        padding: 16,
        whiteSpace: "pre-wrap",
        color: "#f55",
      }}
    >
      {String(
        (err as any)?.stack ||
        (err as any)?.message ||
        err
      )}
    </pre>
  );
}
