FROM mambaorg/micromamba:2.5.0

WORKDIR /home/mambauser/app

RUN micromamba install -y -n base -c conda-forge \
        epics-base=7.0.9 \
        readline \
        make \
        compilers \
    && micromamba clean --all --yes

ARG MAMBA_DOCKERFILE_ACTIVATE=1

COPY --chown=$MAMBA_USER:$MAMBA_USER . .

RUN echo -n "EPICS_BASE=${EPICS_BASE}" > configure/RELEASE.local && \
    make

WORKDIR /home/mambauser/app/iocBoot/iocexample

ENTRYPOINT ["./st.cmd"]
