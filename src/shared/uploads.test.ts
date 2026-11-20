import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, uploadProblem } from "./uploads";

describe("uploads", () => {
  it("take photos and PDFs up to 10 MB", () => {
    expect(uploadProblem({ type: "image/png", size: 100 })).toBeNull();
    expect(uploadProblem({ type: "application/pdf", size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(uploadProblem({ type: "image/gif", size: 100 })).toMatch(/PNG, JPEG, WebP or PDF/);
    expect(uploadProblem({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/10 MB/);
  });
});
