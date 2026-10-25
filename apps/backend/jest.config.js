const { loadEnv } = require("@medusajs/utils");
loadEnv("test", process.cwd());

module.exports = {
  transform: {
    "^.+\\.[jt]s$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", decorators: true },
        },
      },
    ],
  },
  testEnvironment: "node",
  moduleFileExtensions: ["js", "ts", "json"],
  modulePathIgnorePatterns: ["dist/", "<rootDir>/.medusa/"],
  setupFiles: ["./integration-tests/setup.js"],
};

// hotfix CI OOM: integration test ใช้ DB/Redis ร่วมกัน จึงรันทีละ suite (maxWorkers: 1) แต่ใน worker
// แยกที่ถูก recycle เมื่อ heap หลังจบ suite เกิน workerIdleMemoryLimit — แทน --runInBand ที่สะสม
// หน่วยความจำทุก suite ไว้ใน process เดียวจน heap เต็ม (jest >= 29.3 ใช้ worker เสมอเมื่อตั้ง limit)
const INTEGRATION_WORKER = { maxWorkers: 1, workerIdleMemoryLimit: "1024MB" };

if (process.env.TEST_TYPE === "integration:http") {
  module.exports.testMatch = ["**/integration-tests/http/*.spec.[jt]s"];
  Object.assign(module.exports, INTEGRATION_WORKER);
} else if (process.env.TEST_TYPE === "integration:modules") {
  module.exports.testMatch = ["**/src/modules/*/__tests__/**/*.[jt]s"];
  // OPS-6 (AC-8): *.unit.spec.* ถูกรันใน test:unit แล้ว — ไม่จับซ้ำ
  module.exports.testPathIgnorePatterns = ["/node_modules/", "\\.unit\\.spec\\.[jt]s$"];
  Object.assign(module.exports, INTEGRATION_WORKER);
} else if (process.env.TEST_TYPE === "unit") {
  module.exports.testMatch = ["**/src/**/__tests__/**/*.unit.spec.[jt]s"];
}
