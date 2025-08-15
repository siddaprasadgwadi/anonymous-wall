import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, minlength: 3, maxlength: 30, unique: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // hashed
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
