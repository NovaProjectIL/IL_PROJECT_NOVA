'use client';

import { useState } from 'react';
import { Sparkles, MessageCircle, Mail, Send, ArrowLeft, CheckCircle, Menu, X, Zap } from 'lucide-react';
import Link from 'next/link';

export default function ContactPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 2000));

    setIsSubmitting(false);
    setIsSubmitted(true);

    // Reset form after 3 seconds
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  return (
    <div className="nova-container">
      {/* Background Effects */}
      <div className="particles">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="nova-header">
        <div className="header-wrapper">
          <div className="logo-container">
            <div className="logo-circle">
              <Sparkles className="logo-icon" size={24} />
            </div>
            <div className="logo-text-wrapper">
              <h1 className="logo-text">NOVA</h1>
              <span className="logo-tagline">Stream Sync</span>
            </div>
          </div>

          <nav className="nav-menu">
            <Link href="/" className="nav-link">
              <ArrowLeft size={18} />
              <span>Retour</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Contact Section */}
      <section className="contact-section">
        <div className="contact-content">
          <div className="contact-header">
            <div className="badge">
              <MessageCircle className="badge-icon" size={16} />
              <span>Contactez-nous</span>
            </div>

            <h1 className="contact-title">
              Parlons de Votre Expérience
            </h1>

            <p className="contact-description">
              Nous sommes là pour vous aider. Que vous ayez des questions, des suggestions
              ou besoin d'assistance, n'hésitez pas à nous contacter. Notre équipe vous
              répondra dans les plus brefs délais.
            </p>
          </div>

          <div className="contact-grid">
            {/* Contact Info */}
            <div className="contact-info">
              <h2 className="info-title">Informations de Contact</h2>

              <div className="info-items">
                <div className="info-item">
                  <div className="info-icon">
                    <Mail size={24} />
                  </div>
                  <div className="info-content">
                    <h3>Email</h3>
                    <p>support@nova-stream.com</p>
                    <p>contact@nova-stream.com</p>
                  </div>
                </div>

                <div className="info-item">
                  <div className="info-icon">
                    <MessageCircle size={24} />
                  </div>
                  <div className="info-content">
                    <h3>Support</h3>
                    <p>Disponible 24/7</p>
                    <p>Réponse sous 24h</p>
                  </div>
                </div>
              </div>

              <div className="faq-section">
                <h3>Questions Fréquentes</h3>
                <div className="faq-list">
                  <details className="faq-item">
                    <summary>Comment créer un salon ?</summary>
                    <p>Cliquez sur "Créer un Salon" et partagez le code généré avec vos amis.</p>
                  </details>
                  <details className="faq-item">
                    <summary>La synchronisation est-elle parfaite ?</summary>
                    <p>Oui, notre technologie assure une synchronisation en temps réel avec une latence minimale.</p>
                  </details>
                  <details className="faq-item">
                    <summary>Les salons sont-ils privés ?</summary>
                    <p>Absolument, chaque salon est sécurisé et accessible uniquement sur invitation.</p>
                  </details>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="contact-form-container">
              <h2 className="form-title">Envoyez-nous un Message</h2>

              {isSubmitted ? (
                <div className="success-message">
                  <CheckCircle size={48} className="success-icon" />
                  <h3>Message envoyé !</h3>
                  <p>Merci pour votre message. Nous vous répondrons bientôt.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="name">Nom</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="nova-input"
                        placeholder="Votre nom"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="email">Email</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="nova-input"
                        placeholder="votre@email.com"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="subject">Sujet</label>
                    <input
                      type="text"
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      className="nova-input"
                      placeholder="Objet de votre message"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="message">Message</label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      className="nova-input"
                      rows={6}
                      placeholder="Votre message..."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="nova-btn nova-btn-primary form-submit-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner"></div>
                        <span>Envoi en cours...</span>
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        <span>Envoyer le Message</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="nova-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">
              <Sparkles size={24} />
              <span>NOVA</span>
            </div>
            <p className="footer-tagline">
              Streaming synchronisé pour des moments partagés inoubliables
            </p>
          </div>

          <div className="footer-links">
            <Link href="/" className="footer-link">Accueil</Link>
            <span className="footer-separator">•</span>
            <Link href="/about" className="footer-link">À propos</Link>
            <span className="footer-separator">•</span>
            <a href="#support" className="footer-link">Support</a>
          </div>

          <div className="footer-copyright">
            © 2024 NOVA Stream Sync. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
