function updateTimestamp() {
    var now = new Date();
    var ts = now.toISOString().replace('T', ' ').substring(0, 19);
    document.getElementById('timestamp').textContent = ts;
}
updateTimestamp();
setInterval(updateTimestamp, 1000);

document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        var target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// Active nav tracking
document.querySelectorAll('.nav-link').forEach(function(link) {
    link.addEventListener('click', function() {
        document.querySelectorAll('.nav-link').forEach(function(l) {
            l.classList.remove('active');
        });
        this.classList.add('active');
    });
});
