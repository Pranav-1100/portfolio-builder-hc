document.addEventListener('DOMContentLoaded', function() {
    // Initialize all functionality
    initializeNavigation();
    initializeScrollEffects();
    initializeTypingEffect();
    initializeContactForm();
    initializeParticles();
    initializeProjectHovers();
    initializeSmoothScrolling();
  });
  
  // Navigation functionality
  function initializeNavigation() {
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
  
    // Scroll spy for navigation
    window.addEventListener('scroll', function() {
      let current = '';
      
      sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        
        if (scrollY >= (sectionTop - 200)) {
          current = section.getAttribute('id');
        }
      });
  
      // Update active nav link
      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
          link.classList.add('active');
        }
      });
    });
  
    // Mobile navigation toggle (if needed)
    const mobileToggle = document.querySelector('.mobile-toggle');
    if (mobileToggle) {
      mobileToggle.addEventListener('click', function() {
        document.querySelector('.nav-links').classList.toggle('active');
      });
    }
  }
  
  // Scroll effects
  function initializeScrollEffects() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
  
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);
  
    // Observe all sections and cards
    document.querySelectorAll('.section, .tech-card, .project-card, .timeline-item').forEach(el => {
      observer.observe(el);
    });
  
    // Add CSS classes for animations
    const style = document.createElement('style');
    style.textContent = `
      .tech-card, .project-card, .timeline-item {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.6s ease, transform 0.6s ease;
      }
      
      .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Typing effect for hero section
  function initializeTypingEffect() {
    const typewriter = document.querySelector('.typewriter');
    const cursor = document.querySelector('.cursor');
    
    if (!typewriter) return;
  
    const roles = [
      'Full Stack Developer',
      'Software Engineer',
      'Problem Solver',
      'Tech Enthusiast'
    ];
  
    let roleIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let isTyping = false;
  
    function type() {
      if (isTyping) return;
      isTyping = true;
  
      const currentRole = roles[roleIndex];
      
      if (!isDeleting) {
        // Typing
        typewriter.textContent = currentRole.substring(0, charIndex + 1);
        charIndex++;
        
        if (charIndex === currentRole.length) {
          isDeleting = true;
          setTimeout(type, 2000); // Pause before deleting
        } else {
          setTimeout(type, 100);
        }
      } else {
        // Deleting
        typewriter.textContent = currentRole.substring(0, charIndex - 1);
        charIndex--;
        
        if (charIndex === 0) {
          isDeleting = false;
          roleIndex = (roleIndex + 1) % roles.length;
          setTimeout(type, 500); // Pause before typing next
        } else {
          setTimeout(type, 50);
        }
      }
      
      isTyping = false;
    }
  
    // Start typing effect
    setTimeout(type, 1000);
  }
  
  // Contact form functionality
  function initializeContactForm() {
    const contactForm = document.getElementById('contact-form');
    
    if (!contactForm) return;
  
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const formData = new FormData(contactForm);
      const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        message: formData.get('message')
      };
  
      // Show loading state
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Sending...';
      submitBtn.disabled = true;
  
      // Simulate form submission (replace with actual API call)
      setTimeout(() => {
        // Show success message
        showNotification('Message sent successfully! I\'ll get back to you soon.', 'success');
        
        // Reset form
        contactForm.reset();
        
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }, 1500);
    });
  }
  
  // Particle animation
  function initializeParticles() {
    const particlesContainer = document.querySelector('.particles-container');
    
    if (!particlesContainer) return;
  
    // Create particles dynamically
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 20 + 's';
      particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
      particlesContainer.appendChild(particle);
    }
  }
  
  // Project card hover effects
  function initializeProjectHovers() {
    const projectCards = document.querySelectorAll('.project-card');
    
    projectCards.forEach(card => {
      const image = card.querySelector('.project-image img');
      
      card.addEventListener('mouseenter', function() {
        if (image) {
          image.style.transform = 'scale(1.1)';
        }
      });
      
      card.addEventListener('mouseleave', function() {
        if (image) {
          image.style.transform = 'scale(1)';
        }
      });
    });
  }
  
  // Smooth scrolling for navigation links
  function initializeSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        
        const targetId = this.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        
        if (targetSection) {
          const offsetTop = targetSection.offsetTop - 80; // Account for fixed navbar
          
          window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
          });
        }
      });
    });
  }
  
  // Notification system
  function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
  
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    const notificationStyles = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      max-width: 300px;
      font-weight: 500;
    `;
    
    notification.style.cssText = notificationStyles;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 5000);
  }
  
  // Skill bar animations
  function animateSkillBars() {
    const skillBars = document.querySelectorAll('.level-fill');
    
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const bar = entry.target;
          const width = bar.style.width;
          bar.style.width = '0%';
          
          setTimeout(() => {
            bar.style.width = width;
          }, 500);
          
          observer.unobserve(bar);
        }
      });
    });
    
    skillBars.forEach(bar => observer.observe(bar));
  }
  
  // GitHub calendar colors (if using dynamic data)
  function generateCalendarColors(contributionCount) {
    const colors = [
      '#161b22', // 0 contributions
      '#0e4429', // 1-3 contributions
      '#006d32', // 4-6 contributions
      '#26a641', // 7-9 contributions
      '#39d353'  // 10+ contributions
    ];
    
    if (contributionCount === 0) return colors[0];
    if (contributionCount <= 3) return colors[1];
    if (contributionCount <= 6) return colors[2];
    if (contributionCount <= 9) return colors[3];
    return colors[4];
  }
  
  // Lazy loading for images
  function initializeLazyLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });
    
    images.forEach(img => imageObserver.observe(img));
  }
  
  // Utility functions
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  }
  
  // Performance optimizations
  const optimizedScrollHandler = throttle(function() {
    // Handle scroll events efficiently
  }, 16);
  
  window.addEventListener('scroll', optimizedScrollHandler);
  
  // Initialize skill bar animations when page loads
  document.addEventListener('DOMContentLoaded', animateSkillBars);
  
  // Add keyboard navigation support
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      // Close any open modals or dropdowns
      const openElements = document.querySelectorAll('.open, .active');
      openElements.forEach(el => {
        if (!el.classList.contains('nav-link')) {
          el.classList.remove('open', 'active');
        }
      });
    }
  });
  
  // Preload critical resources
  function preloadCriticalResources() {
    const criticalImages = [
      '/static/hero-image.jpg',
      '/static/project-1.jpg'
    ];
    
    criticalImages.forEach(src => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      document.head.appendChild(link);
    });
  }
  
  // Initialize everything when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadCriticalResources);
  } else {
    preloadCriticalResources();
  }