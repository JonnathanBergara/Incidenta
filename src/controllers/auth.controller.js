/**
 * auth.controller.js — Inicio de sesión, perfil y alta de usuarios
 */

const usuarios = require('../models/usuario.model');
const { hashPassword, verificarPassword, hashDeRelleno } = require('../utils/password');
const { sign } = require('../utils/jwt');
const { config } = require('../config');

const MENSAJE_LOGIN = 'Usuario o contraseña incorrectos.';   // mismo texto para ambos casos

async function login(req, res, next) {
  try {
    const { username, password } = req.datos;
    const usuario = await usuarios.getParaLogin(username);
    // Se verifica SIEMPRE un hash (el real o uno de relleno) para igualar tiempos.
    const correcta = await verificarPassword(password, usuario ? usuario.password_hash : hashDeRelleno());
    if (!usuario || !usuario.activo || !correcta) {
      return next({ status: 401, message: MENSAJE_LOGIN });
    }
    const token = sign({ sub: String(usuario.id), username: usuario.username, role: usuario.role });
    res.json({
      token,
      tipo: 'Bearer',
      expiraEn: config.jwt.expiraEnSegundos,
      usuario: { id: usuario.id, username: usuario.username, role: usuario.role }
    });
  } catch (err) {
    next(err);
  }
}

function perfil(req, res) {
  res.json({ usuario: req.user });
}

async function crearUsuario(req, res, next) {
  try {
    const { username, email, password, role } = req.datos;
    const passwordHash = await hashPassword(password);
    res.status(201).json(await usuarios.create({ username, email, passwordHash, role }));
  } catch (err) {
    if (err.code === '23505') {
      return next({ status: 409, message: 'Ese nombre de usuario ya existe.' });
    }
    next(err);
  }
}

module.exports = { login, perfil, crearUsuario };
