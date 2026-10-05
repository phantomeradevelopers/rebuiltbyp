import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface RouteErrorProps {
  error: Error;
  reset: () => void;
}

export function RouteError({ error, reset }: RouteErrorProps) {
  const router = useRouter();
  return (
    <div className="p-6 flex flex-col items-center text-center space-y-3">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">{error.message}</p>
      <Button
        size="sm"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Try again
      </Button>
    </div>
  );
}
