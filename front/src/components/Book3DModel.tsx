import { ClosedBook3D, type ClosedBook3DProps } from "@/components/ClosedBook3D";

/** Livro fechado/deitado. A capa é lida da própria obra. */
export function Book3DModel(props: ClosedBook3DProps) {
  return <ClosedBook3D {...props} pose="lying" />;
}
