-- CreateTable
CREATE TABLE "Reserva" (
    "id" SERIAL NOT NULL,
    "nomeSolicitante" TEXT NOT NULL,
    "dataNascimento" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tipoVinculo" TEXT NOT NULL,
    "codigoMembresia" TEXT,
    "espaco" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "finalidade" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "observacaoAdmin" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaFixa" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "responsavel" TEXT NOT NULL,
    "espaco" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFim" TEXT NOT NULL,
    "dataInicio" TEXT NOT NULL,
    "dataFim" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaFixa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" SERIAL NOT NULL,
    "usuario" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogAcao" (
    "id" SERIAL NOT NULL,
    "reservaId" INTEGER NOT NULL,
    "de" TEXT,
    "para" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reserva_espaco_data_status_idx" ON "Reserva"("espaco", "data", "status");

-- CreateIndex
CREATE INDEX "Reserva_email_data_status_idx" ON "Reserva"("email", "data", "status");

-- CreateIndex
CREATE INDEX "AgendaFixa_espaco_diaSemana_ativa_idx" ON "AgendaFixa"("espaco", "diaSemana", "ativa");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_usuario_key" ON "AdminUser"("usuario");

-- CreateIndex
CREATE INDEX "LogAcao_reservaId_idx" ON "LogAcao"("reservaId");

-- AddForeignKey
ALTER TABLE "LogAcao" ADD CONSTRAINT "LogAcao_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "Reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;
