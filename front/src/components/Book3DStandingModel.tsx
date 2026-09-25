import { ClosedBook3D, type ClosedBook3DProps } from "@/components/ClosedBook3D";

/** Livro fechado/em pé, com a mesma geometria do modelo deitado. */
export function Book3DStandingModel(props: ClosedBook3DProps) {
  return <ClosedBook3D {...props} pose="standing" />;
}
