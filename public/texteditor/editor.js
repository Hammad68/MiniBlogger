// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize Quill
    const quill = new Quill('#editor', {
        theme: 'snow',
        placeholder: 'Start writing your blog content here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link'],
                ['clean']
            ]
        }
    });

    // Character counter
    const charCount = document.getElementById('charCount');

    quill.on('text-change', function() {
        const text = quill.getText().trim();
        const length = text.length;
        charCount.textContent = length;
        
        if (length < 200) {
            charCount.style.color = '#ff6b6b';
        } else if (length > 4500) {
            charCount.style.color = '#ffd93d';
        } else {
            charCount.style.color = '#6bcf7f';
        }
    });

    // Form submission
    document.getElementById('blogForm').addEventListener('submit', function(e) {
        const text = quill.getText().trim();
        const titleLength = document.getElementById('blogTitle').value.trim().length;
        
        // Validate
        if (titleLength < 5) {
            e.preventDefault();
            alert('Title must be at least 5 characters');
            return false;
        }
        
        if (text.length < 200) {
            e.preventDefault();
            alert('Content must be at least 200 characters. Current: ' + text.length);
            return false;
        }
        
        if (text.length > 5000) {
            e.preventDefault();
            alert('Content must be less than 5000 characters. Current: ' + text.length);
            return false;
        }
        
        // Save HTML content
        document.getElementById('blogBody').value = quill.root.innerHTML;
        
        return true;
    });

}); // End of DOMContentLoaded