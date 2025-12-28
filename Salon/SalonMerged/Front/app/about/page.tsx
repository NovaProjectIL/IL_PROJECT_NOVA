'use client';

import { useState } from 'react';
import { Sparkles, Users, Play, MessageCircle, Lock, Zap, Palette, ArrowLeft, Menu, X } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

          <nav className={`nav-menu ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <Link href="/#features" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <Zap size={18} />
              <span>Fonctionnalités</span>
            </Link>
            <Link href="/about" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <Sparkles size={18} />
              <span>À propos</span>
            </Link>
            <Link href="/contact" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
              <MessageCircle size={18} />
              <span>Contact</span>
            </Link>
          </nav>

          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* About Section */}
      <section className="about-section">
        <div className="about-content">
          <div className="about-header">
            <div className="badge">
              <Sparkles className="badge-icon" size={16} />
              <span>À propos de NOVA</span>
            </div>

            <h1 className="about-title">
              Révolutionner le Visionnage Collectif
            </h1>

            <p className="about-description">
              NOVA est une plateforme innovante conçue pour transformer la façon dont vous partagez
              des moments de visionnage avec vos amis et votre famille. Notre mission est de créer
              des connexions authentiques à travers le contenu que vous aimez.
            </p>
          </div>

          <div className="story-section">
            <h2 className="story-title">Notre Histoire</h2>
            <p className="story-text">
              Tout a commencé avec une simple idée : regarder des vidéos YouTube avec des amis
              devrait être aussi simple que d'être dans la même pièce. Nous avons réalisé que
              malgré les avancées technologiques, il n'existait pas de solution élégante pour
              synchroniser le visionnage en temps réel.
            </p>
            <p className="story-text">
              C'est ainsi que NOVA est née. Nous avons développé une plateforme qui non seulement
              synchronise parfaitement la lecture, mais qui intègre également un chat en direct,
              une gestion collaborative des playlists et une interface intuitive qui rend
              l'expérience aussi naturelle que possible.
            </p>
          </div>

          <div className="mission-section">
            <h2 className="mission-title">Notre Mission</h2>
            <div className="mission-grid">
              <div className="mission-card">
                <div className="mission-icon">
                  <Users size={32} />
                </div>
                <h3>Connecter les Gens</h3>
                <p>
                  Créer des liens plus forts entre amis et familles à travers des expériences
                  de visionnage partagées.
                </p>
              </div>

              <div className="mission-card">
                <div className="mission-icon">
                  <Zap size={32} />
                </div>
                <h3>Innovation Technologique</h3>
                <p>
                  Pousser les limites de la synchronisation en temps réel pour offrir une
                  expérience fluide et sans latence.
                </p>
              </div>

              <div className="mission-card">
                <div className="mission-icon">
                  <Lock size={32} />
                </div>
                <h3>Confidentialité et Sécurité</h3>
                <p>
                  Assurer que vos sessions privées restent privées, avec une sécurité de
                  pointe pour protéger vos données.
                </p>
              </div>
            </div>
          </div>

          <div className="tech-section">
            <h2 className="tech-title">Technologie</h2>
            <p className="tech-description">
              NOVA est construite avec les dernières technologies web pour garantir des
              performances optimales et une compatibilité maximale.
            </p>

            <div className="tech-stack">
              <div className="tech-item">
                <span className="tech-name">Frontend</span>
                <span className="tech-detail">Next.js, React, TypeScript</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Backend</span>
                <span className="tech-detail">NestJS, Node.js, Socket.IO</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Base de données</span>
                <span className="tech-detail">PostgreSQL, Redis</span>
              </div>
              <div className="tech-item">
                <span className="tech-name">Infrastructure</span>
                <span className="tech-detail">Docker, Kubernetes</span>
              </div>
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
            <Link href="/contact" className="footer-link">Contact</Link>
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
