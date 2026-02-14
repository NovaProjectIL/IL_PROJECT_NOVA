# NOVA – Synchronized Video Streaming Platform

NOVA is a real-time collaborative video streaming platform that allows multiple users to watch videos together, chat, and manage a shared playlist in synchronization.

This project is developed as part of Projet IL 2025/2026. The objective is to build a realistic web platform inspired by WatchTogether, reproducing its core features while designing our own scalable architecture.

---

## Project Overview

The goal is to create a web application that enables users to:

- Watch videos together in real time
- Chat during playback
- Manage a collaborative playlist
- Interact inside shared rooms

The project is developed over two semesters:

- Semester 1: Minimal viable product (core features)
- Semester 2: Advanced improvements and feature extensions

The development process emphasizes:
- Structured planning
- Team collaboration
- Version control with GitHub
- Clear task distribution
- Software engineering best practices

---

## Core Features

### Real-Time Synchronized Playback
- Play / Pause synchronization
- Seek synchronization
- Shared playback state
- Real-time state broadcasting via WebSockets

### Live Chat
- Instant messaging between participants
- Room-based communication
- Real-time updates

### Collaborative Playlist
- Add videos to queue
- Remove videos
- Automatic next video handling
- Shared playlist state

### Room / Session Management
- Create a room
- Join via link or code
- Multi-user support
- Session-based synchronization

---

## Architecture

The platform follows a client-server architecture.

### Backend
- REST API for standard operations
- WebSocket gateway for real-time synchronization
- Playlist and session management
- Centralized playback state control

### Frontend
- Dynamic video player
- Real-time sync with backend
- Chat interface
- Playlist management UI

---

## Technologies

- Node.js
- WebSockets
- REST API
- Frontend framework (React / Vue / etc.)
- Git & GitHub

---

## Project Structure

/backend
/controllers
/services
/gateways
/models

/frontend
/components
/pages
/services

---

## Work in Progress

The platform is still under active development.

Planned and ongoing improvements include:

- User authentication system
- Role management (host, participants)
- Moderation tools
- UI/UX enhancements
- Performance optimization
- Scalability improvements
- Additional collaborative features

New functionalities are continuously being designed and integrated as the project evolves.

---

## How to Run the Project

### Backend

cd backend
npm install
npm run start

### Frontend

cd frontend
npm install
npm run dev

---

## Academic Context

Projet IL 2025/2026  
Group project – 4 students  

Each member contributes to architecture, implementation, planning, and documentation.  
The project workload is approximately 60–70 hours per student per semester.

---

## License

This project is developed for academic purposes.

If you want, I can also tailor a version more optimized for recruiters (more impact-focused and technical positioning).
