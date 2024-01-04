const path = require("path")
module.exports = {
  webpack:{
    alias:{
      "@":path.resolve(__dirname,"src"),
      "@aceternityUI":path.resolve(__dirname,"src/components/ui")
    }
  }
}