import multer from "multer";

//Configure multer for file upload
const upload = multer({ storage: multer.memoryStorage() });

export default upload;