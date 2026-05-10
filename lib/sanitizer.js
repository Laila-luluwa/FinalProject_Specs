const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const allowedTags = ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'];
const allowedAttr = [];

const sanitizeContent = (dirty)=>{
    return DOMPurify.sanitize(dirty, {
         ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: allowedAttr 
        });
    };

module.exports = { sanitizeContent };

const { sanitizeContent } = require('../lib/sanitizer');
const { clean } = require('xss-clean/lib/xss');

router.post('/posts', requireAuth, async (req, res) => {
    try{
        const { title, content,authorId } = req.body;
        const sanitizedContent = sanitizeContent(content);
        const post = await prisma.post.create({
            data: {
                title: cleanTitle,
                content: cleanContent,
                authorId: parseInt(authorId)
            }
        });

        res.status(201).json(post);
    } catch (error) {
        res.status(500).json({ error: 'Post creation failed' });
    }
});