import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../api/schema.graphql",
  documents: ["src/**/*.{ts,tsx}", "!src/gql/**/*"],
  ignoreNoDocuments: true,
  generates: {
    "./src/gql/": {
      preset: "client",
      presetConfig: { fragmentMasking: false },
      config: {
        documentMode: "documentNode",
        emitLegacyCommonJSImports: false,
        useTypeImports: true,
        enumsAsTypes: true,
        strictScalars: true,
        scalars: { UUID: "string", DateTime: "string", JSON: "unknown" },
      },
    },
  },
};

export default config;
