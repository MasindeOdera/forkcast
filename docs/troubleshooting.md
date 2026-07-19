# 🐛 Troubleshooting

## Common Issues

### 1. "JSON parsing error" when creating meals
- Ensure all required fields are filled
- Check network connectivity
- Verify API endpoints are accessible

### 2. Image upload fails
- Check Cloudinary credentials in `.env`
- Ensure the image is under 10MB
- Verify image format is supported (JPG, PNG, GIF, WebP)

### 3. AI suggestions not working
- Verify `EMERGENT_LLM_KEY` is set correctly
- Check internet connectivity
- Ensure the prompt is descriptive enough

## Development Tips

### MongoDB Connection Issues

```bash
# Start MongoDB locally
mongod --dbpath /path/to/your/db
```

### Clear Browser Data
- Clear `localStorage` if experiencing auth issues
- Hard refresh the page (Ctrl+F5)

### Check Logs

```bash
# View Next.js logs
yarn dev

# Check supervisor logs (production)
sudo supervisorctl status
```
