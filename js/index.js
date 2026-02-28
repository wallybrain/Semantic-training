document.getElementById('year').textContent = new Date().getFullYear();
function updateTimestamp() {
    const now = new Date();
    document.getElementById('timestamp').textContent = now.toISOString().replace('T', ' ').split('.')[0] + ' UTC';
}
updateTimestamp();
setInterval(updateTimestamp, 1000);

// Side scanners
['left', 'right'].forEach(side => {
    const scanner = document.createElement('div');
    scanner.className = `side-scanner side-scanner--${side}`;
    document.body.appendChild(scanner);
    const glow = document.createElement('div');
    glow.className = `side-glow side-glow--${side}`;
    document.body.appendChild(glow);
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});
