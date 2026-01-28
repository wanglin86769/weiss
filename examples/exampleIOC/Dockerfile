FROM mambaorg/micromamba:2.5.0

RUN mkdir -p /home/${MAMBA_USER}/app && \
    chown -R ${MAMBA_USER}:${MAMBA_USER} /home/${MAMBA_USER}

WORKDIR /home/${MAMBA_USER}/app

RUN micromamba install -y -n base -c conda-forge \
        epics-base=7.0.9 \
        readline \
        make \
        compilers \
    && micromamba clean --all --yes

ARG MAMBA_DOCKERFILE_ACTIVATE=1

COPY --chown=${MAMBA_USER}:${MAMBA_USER} . .

RUN echo -n "EPICS_BASE=${EPICS_BASE}" > configure/RELEASE.local && \
    make

WORKDIR /home/${MAMBA_USER}/app/iocBoot/iocexample

ENTRYPOINT ["/usr/local/bin/_entrypoint.sh", "./st.cmd"]
