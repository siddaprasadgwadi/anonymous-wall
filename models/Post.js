import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text:      { type: String, required: true, maxlength: 500 },
    anonymous: { type: Boolean, default: true },
    sentiment: { type: String, enum: ['positive','neutral','negative'], default: 'neutral' },
    isToxic:   { type: Boolean, default: false },
    tags:      [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.model('Post', postSchema);
